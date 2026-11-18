// Session, feed replay, alert queue, reset, audit chain and workspace isolation.
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PlatformAlert } from '../../server/api/index';
import type { AuditEvent, CaseRow } from '../../shared/types';
import { ANALYST, SUPERVISOR, bid, cases, makeApi, scenarioOf } from './helpers';

interface Feed { state: string; cursor: string; ingested: number; total: number; window: { start: string; end: string }; buckets: { start: string; count: number }[]; byRegion: { shapeId: string; count: number }[] }

describe('session', () => {
  it('lists the demo users, the workspace, the connectors and the prepared dismiss reasons', async () => {
    const t = makeApi();
    const s = (await t.call('GET', '/api/session', { browser: bid(1) })).body as { users: { id: string; role: string; basis: string }[]; workspace: { id: string; feed: Feed }; connectors: { source: string; turnaroundMinutes: number }[]; dismissReasons: { code: string }[] };
    expect(s.users.map((u) => [u.id, u.role])).toEqual([['analyst-1', 'analyst'], ['analyst-2', 'analyst'], ['supervisor-1', 'supervisor']]);
    expect(s.users.every((u) => u.basis === 'FICTION')).toBe(true);
    expect(s.workspace.feed.state).toBe('idle');
    expect(s.workspace.id).not.toContain(bid(1));
    expect(s.connectors.map((c) => c.source)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
    expect(s.dismissReasons.length).toBeGreaterThan(0);
  });
});

describe('feed replay', () => {
  it('moves the cursor with the wall clock and speed, and shows only alerts at or before it', async () => {
    const t = makeApi();
    const b = bid(2);
    const idle = (await t.call('GET', '/api/feed/status', { browser: b })).body as Feed;
    expect(idle).toMatchObject({ state: 'idle', ingested: 0, buckets: [] });
    expect(idle.cursor).toBe(idle.window.start);
    expect(await t.alerts(b)).toEqual([]);

    expect((await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST, body: { speed: 60 } })).status).toBe(200);
    t.advance(24); // 24 wall seconds at 60 feed minutes per second is one feed day
    const day = (await t.call('GET', '/api/feed/status', { browser: b })).body as Feed;
    expect(Date.parse(day.cursor) - Date.parse(day.window.start)).toBe(86_400_000);
    expect(day.state).toBe('running');
    expect(day.buckets.length).toBe(97);
    expect(day.buckets.reduce((a, x) => a + x.count, 0)).toBe(day.ingested);
    expect(day.byRegion.reduce((a, x) => a + x.count, 0)).toBeLessThanOrEqual(day.ingested);
    for (const a of await t.alerts(b)) expect(a.detection.at <= day.cursor).toBe(true);

    await t.call('POST', '/api/feed/pause', { browser: b, user: ANALYST });
    t.advance(1000);
    const paused = (await t.call('GET', '/api/feed/status', { browser: b })).body as Feed;
    expect(paused).toMatchObject({ state: 'paused', cursor: day.cursor });

    await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST, body: { speed: 100000 } });
    t.advance(60);
    const done = (await t.call('GET', '/api/feed/status', { browser: b })).body as Feed;
    expect(done).toMatchObject({ state: 'done', cursor: done.window.end, ingested: done.total });
    expect((await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST })).status).toBe(409);
    const all = await t.alerts(b);
    const bound = all.map((a) => scenarioOf(a));
    expect(new Set(bound.filter(Boolean))).toEqual(new Set(['a', 'b', 'c', 'd']));
    // Background behaviour the same generic rules flag: three ordinary groups, no connector data, nothing bound.
    expect(bound.filter((x) => x === null).length).toBe(3);
    expect(new Set(all.filter((a, i) => bound[i] === null).map((a) => a.detection.ruleId))).toEqual(new Set(['DR-1', 'DR-2', 'DR-3']));
    for (const a of all) expect(a).toMatchObject({ simulated: true, status: 'new' });
    // Each bound alert carries its scenario's national-plate region (the shape released at case step 0); unbound alerts carry none.
    all.forEach((a, i) => {
      const sc = bound[i];
      if (!sc || !a.regionShapeId) { expect(a.region).toBeNull(); return; }
      const shape = cases[sc].map.shapes.find((x) => x.id === a.regionShapeId);
      expect(a.region).toEqual({ shapeId: shape?.id, label: shape?.label, points: shape?.points });
      expect(shape?.kind).toBe('region');
    });
    expect(all.some((a) => a.region)).toBe(true);
  });

  it('serves nothing that names a scenario: no scenario field, no case letter, no case code, in an alert, a row or the audit', async () => {
    const t = makeApi();
    const b = bid(30);
    await t.replay(b);
    const all = await t.alerts(b);
    expect(all.length).toBeGreaterThanOrEqual(8);
    const ref = await t.openScenario(b, 'a');
    const bodies = [all, (await t.call('GET', '/api/cases', { browser: b })).body, (await t.call('GET', '/api/audit', { browser: b })).body, (await t.call('GET', `/api/cases/${ref}/signoff`, { browser: b })).body, await t.alerts(b)];
    for (const body of bodies) {
      const json = JSON.stringify(body);
      expect(json).not.toMatch(/"(scenario|caseId)"/);
      expect(json).not.toMatch(/SS-[A-D]\b/);
      expect(json).not.toMatch(/\b(REC|IBCF)-[A-DMN]-/);
      expect(json).not.toMatch(/SH-[A-D]-/);
    }
    const g = await t.getCase(b, ref);
    expect(g.view.id).toBe(ref);
    expect(g.view.code).toBe(ref);
    expect('scenario' in g.case).toBe(false);
    // the alert-open event records the alert and the rule, nothing about the evidence it is bound to
    const open = ((await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[]).find((e) => e.action === 'alert-open') as AuditEvent;
    expect(Object.keys(open.detail).sort()).toEqual(['alertId', 'ruleId']);
  });

  it('a second alert on evidence that already has a case points at that case and cannot open a duplicate', async () => {
    const t = makeApi();
    const b = bid(31);
    await t.replay(b);
    const all = await t.alerts(b);
    const twins = all.filter((a) => scenarioOf(a) === 'a');
    expect(twins.length).toBeGreaterThanOrEqual(2);
    expect(twins.every((a) => a.relatedCaseRef === undefined)).toBe(true);
    const ref = await t.openScenario(b, 'a');
    const after = await t.alerts(b);
    const other = after.find((a) => scenarioOf(a) === 'a' && a.status === 'new') as PlatformAlert;
    expect(other.relatedCaseRef).toBe(ref);
    expect(after.filter((a) => scenarioOf(a) !== 'a').every((a) => a.relatedCaseRef === undefined)).toBe(true);
    const dup = await t.call('POST', `/api/alerts/${other.id}/open`, { browser: b, user: ANALYST });
    expect(dup.status).toBe(409);
    expect((dup.body as { error: { code: string } }).error.code).toBe('same-evidence-case-open');
    expect((await t.call('GET', '/api/cases', { browser: b })).body).toHaveLength(1);
    expect((await t.call('POST', `/api/alerts/${other.id}/dismiss`, { browser: b, user: ANALYST, body: { reasonCode: 'DIS-DUPLICATE' } })).status).toBe(200);
  });

  it('background alerts have no connector data: they cannot be opened and are dismissed with a prepared reason', async () => {
    const t = makeApi();
    const b = bid(32);
    await t.replay(b);
    const bg = (await t.alerts(b)).filter((a) => scenarioOf(a) === null);
    expect(bg.length).toBe(3);
    for (const a of bg) {
      const r = await t.call('POST', `/api/alerts/${a.id}/open`, { browser: b, user: ANALYST });
      expect([r.status, (r.body as { error: { code: string } }).error.code]).toEqual([409, 'no-connector-data']);
    }
    for (const a of bg) expect((await t.call('POST', `/api/alerts/${a.id}/dismiss`, { browser: b, user: ANALYST, body: { reasonCode: 'DIS-KNOWN-ACTIVITY' } })).status).toBe(200);
    expect((await t.alerts(b)).filter((a) => a.status === 'dismissed').length).toBe(3);
  });

  it('lists the records an alert baseline was computed from, with a count and a digest, in pages', async () => {
    const t = makeApi();
    const b = bid(35);
    await t.replay(b);
    const [a] = await t.alerts(b);
    const page = (await t.call('GET', `/api/alerts/${a!.id}/baseline?offset=0&limit=5`, { browser: b })).body as { population: { count: number; sha256: string }; baselineValue: number; recordIds: string[]; window: { start: string } };
    expect(page.population).toEqual(a!.detection.baselinePopulation);
    expect(page.baselineValue).toBe(a!.detection.baseline.value);
    expect(page.recordIds).toHaveLength(5);
    const rest = (await t.call('GET', `/api/alerts/${a!.id}/baseline?offset=5&limit=500`, { browser: b })).body as { recordIds: string[] };
    expect(new Set([...page.recordIds, ...rest.recordIds]).size).toBe(Math.min(page.population.count, 505));
    expect((await t.call('GET', '/api/alerts/ALR-9999/baseline', { browser: b })).status).toBe(404);
    expect((await t.call('GET', `/api/alerts/${a!.id}/baseline?limit=x`, { browser: b })).status).toBe(400);
  });

  it('changing the replay speed while the feed runs applies it and writes an audit event', async () => {
    const t = makeApi();
    const b = bid(33);
    await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST, body: { speed: 60 } });
    t.advance(10);
    const mid = (await t.call('GET', '/api/feed/status', { browser: b })).body as Feed;
    expect(Date.parse(mid.cursor) - Date.parse(mid.window.start)).toBe(600 * 60_000);
    expect((await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST, body: { speed: 600 } })).status).toBe(200);
    t.advance(10);
    const later = (await t.call('GET', '/api/feed/status', { browser: b })).body as Feed;
    // ten seconds at 60, then ten seconds at 600 feed minutes per second
    expect(Date.parse(later.cursor) - Date.parse(later.window.start)).toBe((600 + 6000) * 60_000);
    const ev = ((await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[]).filter((e) => e.action === 'feed-speed');
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ actor: ANALYST, role: 'analyst', detail: { speed: 600, from: 60 } });
    // the same speed again changes nothing and writes nothing
    await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST, body: { speed: 600 } });
    expect(((await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[]).filter((e) => e.action === 'feed-speed')).toHaveLength(1);
  });

  it('feed and reset actions are logged under the signed-in user, and refused when nobody is signed in', async () => {
    const t = makeApi();
    const b = bid(34);
    for (const [path, body] of [['/api/feed/start', {}], ['/api/feed/pause', {}], ['/api/workspace/reset', {}]] as const) {
      const r = await t.call('POST', path, { browser: b, body });
      expect([r.status, (r.body as { error: { code: string } }).error.code]).toEqual([401, 'sign-in-required']);
    }
    expect(((await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[])).toEqual([]);
    await t.call('POST', '/api/feed/start', { browser: b, user: SUPERVISOR });
    await t.call('POST', '/api/feed/pause', { browser: b, user: ANALYST });
    await t.call('POST', '/api/workspace/reset', { browser: b, user: 'analyst-2' });
    const log = (await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[];
    expect(log.map((e) => [e.action, e.actor, e.role])).toEqual([['feed-start', 'supervisor-1', 'supervisor'], ['feed-pause', 'analyst-1', 'analyst'], ['reset', 'analyst-2', 'analyst']]);
    expect(log.some((e) => e.role === 'system')).toBe(false);
  });

  it('the default speed replays the full window in about three minutes', async () => {
    const t = makeApi();
    const b = bid(3);
    await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST });
    t.advance(179);
    expect(((await t.call('GET', '/api/feed/status', { browser: b })).body as Feed).state).toBe('running');
    t.advance(2);
    expect(((await t.call('GET', '/api/feed/status', { browser: b })).body as Feed).state).toBe('done');
  });

  it('refuses a speed that is not a number in range', async () => {
    const t = makeApi();
    for (const body of [{ speed: '60' }, { speed: 0 }, { speed: -5 }, { speed: 1e9 }, { speed: 60, note: 'x' }]) expect((await t.call('POST', '/api/feed/start', { browser: bid(4), user: ANALYST, body })).status).toBe(400);
  });
});

describe('alert queue', () => {
  it('dismisses with prepared codes only, one case per alert, analyst role only', async () => {
    const t = makeApi();
    const b = bid(5);
    await t.replay(b);
    const [first, second] = await t.alerts(b) as [PlatformAlert, PlatformAlert];
    expect((await t.call('POST', `/api/alerts/${first.id}/dismiss`, { browser: b, user: ANALYST, body: { reasonCode: 'looks fine' } })).status).toBe(400);
    expect((await t.call('POST', `/api/alerts/${first.id}/dismiss`, { browser: b, user: ANALYST, body: { reasonCode: 'DIS-KNOWN-ACTIVITY', note: 'x' } })).status).toBe(400);
    expect((await t.call('POST', `/api/alerts/${first.id}/dismiss`, { browser: b, user: SUPERVISOR, body: { reasonCode: 'DIS-KNOWN-ACTIVITY' } })).status).toBe(403);
    const d = await t.call('POST', `/api/alerts/${first.id}/dismiss`, { browser: b, user: ANALYST, body: { reasonCode: 'DIS-KNOWN-ACTIVITY' } });
    expect(d.body).toMatchObject({ status: 'dismissed', dismissReasonCode: 'DIS-KNOWN-ACTIVITY' });
    expect((await t.call('POST', `/api/alerts/${first.id}/open`, { browser: b, user: ANALYST })).status).toBe(409);

    expect((await t.call('POST', `/api/alerts/${second.id}/open`, { browser: b, user: SUPERVISOR })).status).toBe(403);
    const o = await t.call('POST', `/api/alerts/${second.id}/open`, { browser: b, user: ANALYST });
    expect(o.status).toBe(201);
    expect((o.body as CaseRow).ref).toMatch(/^TFIU-\d{4}-0001$/);
    expect((await t.call('POST', `/api/alerts/${second.id}/open`, { browser: b, user: ANALYST })).status).toBe(409);
    expect((await t.alerts(b)).find((a) => a.id === second.id)).toMatchObject({ status: 'case-opened', caseRef: (o.body as CaseRow).ref });
    expect((await t.call('POST', '/api/alerts/ALR-9999/open', { browser: b, user: ANALYST })).status).toBe(404);
  });

  it('an alert after the cursor cannot be opened', async () => {
    const t = makeApi();
    const b = bid(6);
    await t.call('POST', '/api/feed/start', { browser: b, user: ANALYST, body: { speed: 1 } });
    expect((await t.call('POST', '/api/alerts/ALR-0001/open', { browser: b, user: ANALYST })).status).toBe(404);
  });
});

describe('reset', () => {
  it('clears alerts, cases and rows; the audit keeps a reset event and new refs never repeat', async () => {
    const t = makeApi();
    const b = bid(7);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    expect((await t.call('POST', '/api/workspace/reset', { browser: b, user: ANALYST })).status).toBe(200);
    expect((await t.call('GET', '/api/cases', { browser: b })).body).toEqual([]);
    expect(await t.alerts(b)).toEqual([]);
    expect((await t.call('GET', `/api/cases/${ref}`, { browser: b })).status).toBe(404);
    const audit = (await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[];
    expect(audit.some((e) => e.action === 'reset')).toBe(true);
    await t.replay(b);
    const ref2 = await t.openScenario(b, 'a');
    expect(ref2).not.toBe(ref);
  });
});

describe('audit chain', () => {
  it('every state change writes one hash-chained event and verify recomputes the chain', async () => {
    const t = makeApi();
    const b = bid(8);
    await t.replay(b);
    const ref = await t.openScenario(b, 'd');
    await t.runToSignoff(b, ref);
    const audit = (await t.call('GET', '/api/audit', { browser: b })).body as AuditEvent[];
    const actions = new Set(audit.map((e) => e.action));
    for (const a of ['feed-start', 'alert-open', 'step-released', 'level-change', 'collection-request', 'collection-return', 'hypotheses-recorded']) expect(actions.has(a), a).toBe(true);
    audit.forEach((e, i) => {
      expect(e.seq).toBe(i + 1);
      if (i > 0) expect(e.prevHash).toBe(audit[i - 1]?.hash);
      expect(e.hash).toMatch(/^[0-9a-f]{64}$/);
    });
    expect(((await t.call('GET', `/api/audit?caseRef=${ref}`, { browser: b })).body as AuditEvent[]).every((e) => e.caseRef === ref)).toBe(true);
    expect((await t.call('GET', '/api/audit?caseRef=<x>', { browser: b })).status).toBe(400);
    expect((await t.call('GET', '/api/audit/verify', { browser: b })).body).toMatchObject({ simulated: true, ok: true, length: audit.length, hashChain: true, signatures: true, head: true, headSeq: audit.length });
  });

  it('tampering with one line is detected at that line', async () => {
    const t = makeApi();
    const b = bid(9);
    await t.replay(b);
    await t.openScenario(b, 'a');
    const path = await t.auditPath(b);
    const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
    const k = 2;
    const e = JSON.parse(lines[k] as string) as AuditEvent;
    lines[k] = JSON.stringify({ ...e, actor: 'analyst-2' });
    writeFileSync(path, lines.join('\n') + '\n');
    expect((await t.call('GET', '/api/audit/verify', { browser: b })).body).toMatchObject({ ok: false, length: lines.length, brokenAt: k + 1 });
  });
});

describe('isolation', () => {
  it('one browser id never sees another one\'s feed, alerts, cases or audit', async () => {
    const t = makeApi();
    const one = bid(10);
    const two = bid(11);
    await t.replay(one);
    const ref = await t.openScenario(one, 'a');
    expect(((await t.call('GET', '/api/feed/status', { browser: two })).body as Feed).state).toBe('idle');
    expect(await t.alerts(two)).toEqual([]);
    expect((await t.call('GET', '/api/cases', { browser: two })).body).toEqual([]);
    expect((await t.call('GET', `/api/cases/${ref}`, { browser: two })).status).toBe(404);
    expect((await t.call('GET', '/api/audit', { browser: two })).body).toEqual([]);
  });
});
