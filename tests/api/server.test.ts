// Real HTTP round trips through api/server.ts, over a data directory that holds no ground truth file.
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApi } from '../../server/api/index';
import type { PlatformAlert } from '../../server/api/index';
import { startServer } from '../../server/api/server';
import type { CaseId, CaseRow, StepTrigger } from '../../shared/types';
import { ANALYST, DATA, SUPERVISOR, T0, TEST_AUDIT_KEY, cases, codeFor, promoteCode, scenarioOf } from './helpers';

let server: Server;
let base = '';
let now = T0.getTime();
const browser = 'abcdef0123456789abcdef01';
const dataDir = mkdtempSync(join(tmpdir(), 'ss-data-'));

beforeAll(async () => {
  for (const f of readdirSync(DATA)) if (f !== 'ground-truth.json') copyFileSync(join(DATA, f), join(dataDir, f));
  const api = createApi({ dataDir, runtimeDir: mkdtempSync(join(tmpdir(), 'ss-http-')), auditKey: TEST_AUDIT_KEY, now: () => new Date(now) });
  server = await startServer(api, 0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise((ok) => server.close(ok)));

const req = async (method: string, path: string, user?: string, body?: unknown) => {
  const r = await fetch(`${base}${path}`, { method, headers: { 'x-browser-id': browser, ...(user ? { 'x-demo-user': user } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const t = await r.text();
  return { status: r.status, headers: r.headers, text: t, json: () => JSON.parse(t) };
};

async function work(id: CaseId): Promise<string> {
  const alerts = (await req('GET', '/api/alerts')).json() as PlatformAlert[];
  const a = alerts.find((x) => scenarioOf(x) === id && x.status === 'new') as PlatformAlert;
  const opened = await req('POST', `/api/alerts/${a.id}/open`, ANALYST);
  expect(opened.status).toBe(201);
  const ref = (opened.json() as CaseRow).ref;
  for (let i = 0; i < 40; i++) {
    const g = (await req('GET', `/api/cases/${ref}`)).json() as { next: { trigger: StepTrigger } | null };
    const t = g.next?.trigger;
    if (!t || t.kind === 'signoff') break;
    const body = t.kind === 'collect' || t.kind === 'test' ? { kind: t.kind, source: t.source } : { kind: t.kind };
    expect((await req('POST', `/api/cases/${ref}/actions`, ANALYST, body)).status).toBe(201);
    now += 11_000;
  }
  return ref;
}

describe('http round trip', () => {
  it('listens on the loopback interface only', () => {
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
  });

  it('starts the feed, raises alerts, and works case a to a referral', async () => {
    const s = await req('GET', '/api/session');
    expect(s.status).toBe(200);
    expect(s.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await req('POST', '/api/feed/start', ANALYST, { speed: 1000 })).status).toBe(200);
    now += 60_000;
    expect(((await req('GET', '/api/feed/status')).json() as { state: string }).state).toBe('done');
    const alerts = (await req('GET', '/api/alerts')).json() as PlatformAlert[];
    for (const id of ['a', 'b', 'c', 'd']) expect(alerts.some((x) => scenarioOf(x) === id)).toBe(true);

    const ref = await work('a');
    const entry = cases.a.signoff.signableEntryId as string;
    expect((await req('POST', `/api/cases/${ref}/signoff`, ANALYST, { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) })).status).toBe(201);
    expect((await req('POST', `/api/cases/${ref}/supervisor`, ANALYST, { entryId: entry, checks: cases.a.signoff.supervisorChecks.map((k) => ({ id: k.id, passed: true })) })).status).toBe(403);
    expect((await req('POST', `/api/cases/${ref}/supervisor`, SUPERVISOR, { entryId: entry, checks: cases.a.signoff.supervisorChecks.map((k) => ({ id: k.id, passed: true })) })).status).toBe(201);
    expect((await req('POST', `/api/cases/${ref}/referral`, ANALYST)).status).toBe(201);
    const pk = await req('GET', `/api/cases/${ref}/referral/packet`);
    expect(pk.status).toBe(200);
    expect(pk.headers.get('content-security-policy')).toBe("default-src 'none'; style-src 'unsafe-inline'");
    expect(pk.text).toContain('SIMULATED // EXERCISE DATA');
    expect(((await req('GET', `/api/cases/${ref}`)).json() as { case: CaseRow }).case.status).toBe('referred');
  });

  for (const id of ['b', 'c', 'd'] as const) {
    it(`works case ${id} to an assessment record`, async () => {
      const ref = await work(id);
      const g = (await req('GET', `/api/cases/${ref}`)).json() as { levels: { entryId: string; level: number | null }[] };
      const open = g.levels.find((x) => x.level === 4) as { entryId: string };
      const r = await req('POST', `/api/cases/${ref}/signoff`, ANALYST, { entryId: open.entryId, action: 'hold', reasonCode: codeFor(cases[id], open.entryId, 'hold') });
      expect(r.status).toBe(201);
      expect((r.json() as { row: { kind: string } }).row.kind).toBe('assessment');
      expect(((await req('GET', `/api/cases/${ref}`)).json() as { case: CaseRow }).case.status).toBe('closed-assessment');
      expect((await req('POST', `/api/cases/${ref}/referral`, ANALYST)).status).toBe(409);
    });
  }

  it('refuses an oversized and a malformed body, and the audit chain verifies', async () => {
    const r = await fetch(`${base}/api/feed/start`, { method: 'POST', headers: { 'x-browser-id': browser, 'x-demo-user': ANALYST }, body: 'x'.repeat(10 * 1024) });
    expect(r.status).toBe(400);
    expect((await fetch(`${base}/api/feed/start`, { method: 'POST', headers: { 'x-browser-id': browser, 'x-demo-user': ANALYST }, body: '{nope' })).status).toBe(400);
    expect((await req('GET', '/api/audit/verify')).json()).toMatchObject({ ok: true });
  });
});
