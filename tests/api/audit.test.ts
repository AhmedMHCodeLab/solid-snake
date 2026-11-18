// The audit chain gates state: three independent checks (hash chain, signature, head record), every write refused while
// any of them fails, and reads served only from the verified prefix.
import { appendFileSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApi } from '../../server/api/index';
import { auditKeyFrom, createStore, hashOf } from '../../server/api/store';
import type { AuditEvent } from '../../shared/types';
import { ANALYST, DATA, SUPERVISOR, T0, TEST_AUDIT_KEY, bid, cases, makeApi, promoteCode } from './helpers';

type T = ReturnType<typeof makeApi>;

/** A workspace with case a signed by the analyst and not yet countersigned. Returns what a forger needs. */
async function ready(n: number) {
  const t = makeApi();
  const b = bid(n);
  await t.replay(b);
  const ref = await t.openScenario(b, 'a');
  await t.runToSignoff(b, ref);
  const entry = cases.a.signoff.signableEntryId as string;
  await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) } });
  return { t, b, ref, entry };
}
const verify = async (t: T, b: string) => (await t.call('GET', '/api/audit/verify', { browser: b })).body as { ok: boolean; length: number; brokenAt?: number; hashChain: boolean; signatures: boolean; head: boolean };
const lastOf = (path: string) => JSON.parse(readFileSync(path, 'utf8').split('\n').filter(Boolean).at(-1) as string) as AuditEvent & { mac?: string };

/** A supervisor countersign that a forger would write: the one event that unlocks the referral. */
const forgery = (last: AuditEvent, entry: string) => ({ ...last, seq: last.seq + 1, actor: SUPERVISOR, role: 'supervisor', action: 'countersign', detail: { entryId: entry, result: 'sign', analyst: ANALYST, checks: 'SC-1:passed,SC-2:passed,SC-3:passed' }, prevHash: last.hash });

async function refusedReferral(t: T, b: string, ref: string) {
  const r = await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST });
  expect([r.status, (r.body as { error: { code: string } }).error.code]).toEqual([409, 'audit-chain-broken']);
}

describe('audit chain gates state', () => {
  it('verifies all three checks on an untouched log', async () => {
    const { t, b } = await ready(1);
    const v = await verify(t, b);
    expect(v).toMatchObject({ ok: true, hashChain: true, signatures: true, head: true });
  });

  it('a forged line with a bad hash is detected and the referral is refused', async () => {
    const { t, b, ref, entry } = await ready(2);
    const path = await t.auditPath(b);
    appendFileSync(path, JSON.stringify({ ...forgery(lastOf(path), entry), hash: 'f'.repeat(64) }) + '\n');
    const v = await verify(t, b);
    expect(v).toMatchObject({ ok: false, hashChain: false });
    await refusedReferral(t, b, ref);
  });

  it('a forged line with a correctly recomputed plain hash is detected by its signature, and the referral is refused', async () => {
    const { t, b, ref, entry } = await ready(3);
    const path = await t.auditPath(b);
    const body = forgery(lastOf(path), entry) as Record<string, unknown>;
    delete body.hash;
    delete body.mac;
    appendFileSync(path, JSON.stringify({ ...body, hash: hashOf(body as never) }) + '\n');
    const v = await verify(t, b);
    expect(v).toMatchObject({ ok: false, hashChain: true, signatures: false });
    expect(v.brokenAt).toBe(v.length);
    await refusedReferral(t, b, ref);
    // the forged countersign never reaches state: the case still waits for a supervisor
    expect(((await t.call('GET', `/api/cases/${ref}`, { browser: b })).body as { case: { status: string } }).case.status).toBe('awaiting-supervisor');
  });

  for (const cut of [1, 3]) {
    it(`truncation by ${cut} line${cut === 1 ? '' : 's'} is detected by the head record, and every write is refused`, async () => {
      const { t, b, ref } = await ready(10 + cut);
      const path = await t.auditPath(b);
      const ls = readFileSync(path, 'utf8').split('\n').filter(Boolean);
      writeFileSync(path, ls.slice(0, -cut).join('\n') + '\n');
      const v = await verify(t, b);
      expect(v).toMatchObject({ ok: false, hashChain: true, signatures: true, head: false, length: ls.length - cut });
      await refusedReferral(t, b, ref);
      for (const [p, body] of [['/api/feed/pause', {}], ['/api/workspace/reset', {}]] as const) {
        const r = await t.call('POST', p, { browser: b, user: ANALYST, body });
        expect([r.status, (r.body as { error: { code: string } }).error.code]).toEqual([409, 'audit-chain-broken']);
      }
      // nothing was added to the log by the refused writes
      expect(readFileSync(path, 'utf8').split('\n').filter(Boolean).length).toBe(ls.length - cut);
    });
  }

  it('deleting the head record, or a signature, is detected', async () => {
    const { t, b } = await ready(20);
    const path = await t.auditPath(b);
    const ls = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    const e = JSON.parse(ls[3] as string) as Record<string, unknown>;
    delete e.mac;
    writeFileSync(path, [...ls.slice(0, 3), JSON.stringify(e), ...ls.slice(4)].join('\n') + '\n');
    expect(await verify(t, b)).toMatchObject({ ok: false, signatures: false, brokenAt: 4 });
  });

  it('keeps the secret out of the runtime directory and the log, and reads state from the verified prefix only', async () => {
    const { t, b, ref, entry } = await ready(21);
    const path = await t.auditPath(b);
    expect(readdirSync(t.runtimeDir).some((f) => f.includes('key'))).toBe(false);
    expect(readdirSync(t.runtimeDir).map((f) => readFileSync(join(t.runtimeDir, f), 'utf8')).join('')).not.toContain(TEST_AUDIT_KEY);
    appendFileSync(path, JSON.stringify({ ...forgery(lastOf(path), entry), hash: '0'.repeat(64) }) + '\n');
    const audit = (await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[];
    expect(audit.some((e) => e.action === 'countersign')).toBe(false);
    expect((await t.call('GET', `/api/cases/${ref}`, { browser: b })).status).toBe(200);
  });

  it('a log signed under another key fails verification and refuses writes (a regenerated or swapped key is not accepted)', async () => {
    const { t, b, ref } = await ready(22);
    const other = createApi({ dataDir: DATA, runtimeDir: t.runtimeDir, auditKey: 'a-different-secret-0123456789abcdef0123456', now: () => new Date(T0) });
    const call = (m: string, u: string) => other.handle({ method: m, path: u, query: new URL(u, 'http://x').searchParams, headers: { 'x-browser-id': b, 'x-demo-user': ANALYST }, body: m === 'POST' ? '{}' : undefined });
    expect(((await call('GET', '/api/audit/verify')).body as { ok: boolean }).ok).toBe(false);
    expect((await call('POST', `/api/cases/${ref}/referral`)).status).toBe(409);
  });

  it('fails closed on a missing or short signing key: no default, no generated replacement', () => {
    expect(() => auditKeyFrom({})).toThrow(/does not start/);
    expect(() => auditKeyFrom({ AUDIT_HMAC_KEY: 'short' })).toThrow(/shorter/);
    expect(() => createStore(mkdtempSync(join(tmpdir(), 'ss-k-')), 'short')).toThrow(/at least/);
    expect(auditKeyFrom({ AUDIT_HMAC_KEY: TEST_AUDIT_KEY })).toBe(TEST_AUDIT_KEY);
    const keyFile = join(mkdtempSync(join(tmpdir(), 'ss-kf-')), 'k');
    writeFileSync(keyFile, `${TEST_AUDIT_KEY}\n`);
    expect(auditKeyFrom({ AUDIT_HMAC_KEY_FILE: keyFile })).toBe(TEST_AUDIT_KEY);
    expect(() => auditKeyFrom({ AUDIT_HMAC_KEY_FILE: join(tmpdir(), 'ss-no-such-key-file') })).toThrow();
  });
});
