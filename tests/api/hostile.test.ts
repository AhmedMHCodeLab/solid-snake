// Hostile input at the trust boundary: refused, nothing stored, never reflected.
import { describe, expect, it } from 'vitest';
import { ANALYST, bid, cases, makeApi, promoteCode, text } from './helpers';

const HOSTILE = ['<script>alert(1)</script>', 'attacker@example.invalid', 'https://evil.example.invalid/x', 'javascript:alert(1)', '"><img src=x onerror=alert(1)>'];

describe('hostile input', () => {
  it('refuses malformed or hostile writes on every case endpoint, stores nothing and never reflects the input', async () => {
    const t = makeApi();
    const b = bid(1);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    await t.runToSignoff(b, ref);
    const before = await t.auditLines(b);
    const entry = cases.a.signoff.signableEntryId as string;
    const good = { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) };
    const bodies: unknown[] = [
      { ...good, reasonCode: 'RC-NOT-A-CODE' },
      { ...good, note: 'free text' },
      { ...good, action: 'sign' },
      { ...good, entryId: 'H-ZZ' },
      { entryId: entry, action: 'promote' },
      { ...good, entryId: 5 },
      { entryId: entry, checks: 'all passed' },
      { entryId: entry, checks: [{ id: 'SC-1', passed: 'yes' }] },
      { kind: 'collect', source: 'E9' },
      { kind: 'collect', source: 'E2', comment: 'urgent' },
      [good],
      'just a string',
      null,
      '{not json',
      JSON.stringify(good) + ' '.repeat(10 * 1024),
      ...HOSTILE.flatMap((h) => [{ ...good, reasonCode: h }, { ...good, entryId: h }, { ...good, action: h }, { ...good, extra: h }, { ...good, [h]: 'x' }, { kind: h }, { entryId: entry, checks: [{ id: h, passed: true }] }]),
    ];
    for (const body of bodies) {
      for (const path of ['signoff', 'supervisor', 'referral', 'actions']) {
        const r = await t.call('POST', `/api/cases/${ref}/${path}`, { browser: b, user: ANALYST, body });
        expect(r.status, `${path} ${JSON.stringify(body).slice(0, 60)}`).toBeGreaterThanOrEqual(400);
        expect(r.status).toBeLessThan(500);
        const err = r.body as { simulated: boolean; error: { code: string; message: string } };
        expect(err.simulated).toBe(true);
        expect(err.error.code).toMatch(/^[a-z0-9-]+$/);
        for (const h of HOSTILE) expect(text(r)).not.toContain(h);
      }
    }
    expect(await t.auditLines(b)).toEqual(before);
    for (const r of [await t.call('GET', `/api/cases/${ref}`, { browser: b }), await t.call('GET', '/api/audit', { browser: b })]) for (const h of HOSTILE) expect(text(r)).not.toContain(h);
  });

  it('refuses a missing or malformed browser id and an unknown demo user', async () => {
    const t = makeApi();
    for (const id of [undefined, '', 'short', 'ABCDEF0123456789ABCD', 'a'.repeat(65), '<script>alert(1)</script>']) {
      const headers: Record<string, string> = id === undefined ? {} : { 'x-browser-id': id };
      for (const [m, p] of [['GET', '/api/session'], ['GET', '/api/alerts'], ['POST', '/api/feed/start'], ['GET', '/api/cases'], ['GET', '/api/audit/verify']] as const) {
        const r = await t.call(m, p, { headers });
        expect(r.status).toBe(400);
        expect((r.body as { error: { code: string } }).error.code).toBe('bad-browser-id');
      }
    }
    for (const u of ['root', '<script>', 'supervisor-2']) {
      const r = await t.call('POST', '/api/alerts/ALR-0001/open', { browser: bid(2), user: u });
      expect(r.status).toBe(401);
      expect(text(r)).not.toContain(u);
    }
  });

  it('refuses hostile path and query values without echoing them', async () => {
    const t = makeApi();
    const b = bid(3);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    for (const h of HOSTILE) {
      for (const q of [`ids=${encodeURIComponent(h)}`, `entry=${encodeURIComponent(h)}&level=1`, `entry=A-1&level=${encodeURIComponent(h)}`]) {
        const r = await t.call('GET', `/api/cases/${ref}/records?${q}`, { browser: b });
        expect(r.status).toBe(400);
        expect(text(r)).not.toContain(h);
      }
      for (const p of [`/api/cases/${encodeURIComponent(h)}`, `/api/alerts/${encodeURIComponent(h)}/open`]) {
        const r = await t.call(p.endsWith('open') ? 'POST' : 'GET', p, { browser: b, user: ANALYST });
        expect(r.status).toBe(404);
        expect(text(r)).not.toContain(h);
      }
    }
  });

  it('serves only released records', async () => {
    const t = makeApi();
    const b = bid(4);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    const ibcf = cases.a.records.ibcf[0]?.id as string;
    const r = (await t.call('GET', `/api/cases/${ref}/records?ids=${ibcf}`, { browser: b })).body as { total: number; unknown: string[] };
    expect(r).toMatchObject({ total: 0, unknown: [ibcf] });
    const l1 = (await t.call('GET', `/api/cases/${ref}/records?entry=A-1&level=1&limit=100`, { browser: b })).body as { total: number; records: unknown[] };
    expect(l1.total).toBe(cases.a.claims[0]?.versions[0]?.evidenceIds.length);
    expect((await t.call('GET', `/api/cases/${ref}/records?entry=H-A1&level=4`, { browser: b })).status).toBe(404);
  });

  it('answers unknown paths and methods with refusals carrying the simulated flag', async () => {
    const t = makeApi();
    for (const [m, p, status] of [['GET', '/api/nope', 404], ['DELETE', '/api/cases', 405], ['GET', '/api/feed/start', 405], ['GET', '/api/cases/a', 404]] as const) {
      const r = await t.call(m, p, { browser: bid(5) });
      expect(r.status).toBe(status);
      expect((r.body as { simulated: boolean }).simulated).toBe(true);
      expect(r.headers?.['x-content-type-options']).toBe('nosniff');
    }
  });
});
