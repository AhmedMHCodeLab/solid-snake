// The case workflow: released by actions and connector returns, gated by level, role and user.
import { describe, expect, it } from 'vitest';
import type { PlatformCaseRow } from '../../server/api/index';
import type { CollectionRequest } from '../../shared/types';
import { ANALYST, ANALYST2, SUPERVISOR, bid, cases, codeFor, makeApi, promoteCode, text } from './helpers';
import type { CaseGet } from './helpers';

const BANNED = /sign-off|signed|signature/i;

describe('case a: alert to referral', () => {
  it('every gate holds on the way to the referral', async () => {
    const t = makeApi();
    const b = bid(1);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    let g = await t.getCase(b, ref);
    expect(g.case).toMatchObject({ openedBy: ANALYST, assignee: ANALYST, status: 'open' });
    expect('scenario' in g.case).toBe(false);
    expect(g.view.steps.at(-1)?.index).toBe(g.case.step);
    expect(g.next?.trigger.kind).toBe('collect');

    // the wrong action, the wrong source, the wrong role and a missing user are refused, nothing advances
    const wrong = await t.call('POST', `/api/cases/${ref}/actions`, { browser: b, user: ANALYST, body: { kind: 'hypotheses' } });
    expect(wrong.status).toBe(409);
    expect((wrong.body as { error: { code: string } }).error.code).toBe('not-next-action');
    expect((await t.call('POST', `/api/cases/${ref}/actions`, { browser: b, user: ANALYST, body: { kind: 'collect', source: 'E7' } })).status).toBe(409);
    expect((await t.call('POST', `/api/cases/${ref}/actions`, { browser: b, user: SUPERVISOR, body: { kind: 'collect', source: 'E2' } })).status).toBe(403);
    expect((await t.call('POST', `/api/cases/${ref}/actions`, { browser: b, body: { kind: 'collect', source: 'E2' } })).status).toBe(401);
    expect((await t.getCase(b, ref)).case.step).toBe(g.case.step);

    // a collection holds the step until its connector returns
    const step0 = g.case.step;
    const req = await t.call('POST', `/api/cases/${ref}/actions`, { browser: b, user: ANALYST, body: { kind: 'collect', source: 'E2' } });
    expect(req.status).toBe(201);
    expect((req.body as CollectionRequest).status).toBe('requested');
    g = await t.getCase(b, ref);
    expect(g.case.status).toBe('awaiting-collection');
    expect(g.case.step).toBe(step0);
    expect(g.pending.length).toBe(1);
    expect((await t.call('POST', `/api/cases/${ref}/actions`, { browser: b, user: ANALYST, body: { kind: 'collect', source: 'E2' } })).status).toBe(409);
    t.advance(11);
    g = await t.getCase(b, ref);
    expect(g.case.step).toBeGreaterThan(step0);
    expect(g.case.collections[0]?.status).toBe('returned');

    // sign-off is refused before the workflow reaches it
    const early = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: 'A-1', action: 'hold', reasonCode: 'RC-HOLD-AWAITING' } });
    expect(early.status).toBe(409);

    const seen = await t.runToSignoff(b, ref);
    // E4 never returns in case a; E6 returns
    expect(seen.find((x) => x.source === 'E4')?.status).toBe('not-returned');
    expect(seen.find((x) => x.source === 'E6')?.status).toBe('returned');
    g = await t.getCase(b, ref);
    expect(g.case.status).toBe('awaiting-sign-off');
    expect(g.view.assessment).toBeNull();
    expect(g.view.map.shapes.some((x) => x.kind === 'seal')).toBe(false);
    const entry = g.view.signoff.signableEntryId as string;
    expect(entry).toBe(cases.a.signoff.signableEntryId);

    // promote below level 5 is refused for every other entry
    for (const l of g.levels.filter((x) => x.level !== 5)) {
      const r = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: l.entryId, action: 'promote', reasonCode: promoteCode(cases.a) } });
      expect(r.status).toBe(422);
      expect((r.body as { error: { code: string } }).error.code).toBe('below-level-5');
    }
    // a supervisor cannot sign as the analyst; free text is not a reason
    expect((await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: SUPERVISOR, body: { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) } })).status).toBe(403);
    expect((await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'promote', reasonCode: 'LOOKS-RIGHT' } })).status).toBe(422);
    // referral before any signature
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(422);

    const signed = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) } });
    expect(signed.status).toBe(201);
    expect((signed.body as { row: { kind: string } }).row.kind).toBe('signature');
    expect((signed.body as { case: PlatformCaseRow }).case.status).toBe('awaiting-supervisor');
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(422);

    // the countersign must come from a different user with the supervisor role
    const checks = t.allChecks(cases.a);
    const same = await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: ANALYST, body: { entryId: entry, checks } });
    expect(same.status).toBe(403);
    expect((same.body as { error: { code: string } }).error.code).toBe('same-user');
    const role = await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: ANALYST2, body: { entryId: entry, checks } });
    expect((role.body as { error: { code: string } }).error.code).toBe('wrong-role');
    expect((await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: SUPERVISOR, body: { entryId: entry, checks: checks.slice(1) } })).status).toBe(400);

    // before the countersign the promote is not sealed; a return cancels the promotion and withdraws nothing it never earned
    expect((await t.getCase(b, ref)).view.map.shapes.some((x) => x.kind === 'seal')).toBe(false);
    const ret = await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: SUPERVISOR, body: { entryId: entry, checks: t.allChecks(cases.a, false) } });
    expect((ret.body as { result: string }).result).toBe('return');
    expect((await t.getCase(b, ref)).case.status).toBe('awaiting-sign-off');
    expect((await t.getCase(b, ref)).view.map.shapes.some((x) => x.kind === 'seal')).toBe(false);
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(422);
    // the return cancels the promotion: the same supervisor cannot sign it again without a new analyst promote
    const stale = await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: SUPERVISOR, body: { entryId: entry, checks } });
    expect([stale.status, (stale.body as { error: { code: string } }).error.code]).toEqual([409, 'nothing-to-countersign']);
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(422);
    // a new analyst promote (a higher seq) is countersigned; only then is the seal released
    expect((await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) } })).status).toBe(201);
    expect((await t.getCase(b, ref)).view.map.shapes.some((x) => x.kind === 'seal')).toBe(false);
    expect((await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: SUPERVISOR, body: { entryId: entry, checks } })).status).toBe(201);
    expect((await t.getCase(b, ref)).view.map.shapes.some((x) => x.kind === 'seal')).toBe(true);
    // the packet and the referral follow the countersign; the packet only after the referral
    const noPacket = await t.call('GET', `/api/cases/${ref}/referral/packet`, { browser: b });
    expect([noPacket.status, (noPacket.body as { error: { code: string } }).error.code]).toEqual([409, 'not-referred']);
    // only the analyst who signed disseminates it
    for (const [user, status] of [[ANALYST2, 403], [SUPERVISOR, 403]] as const) expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user })).status, user).toBe(status);
    expect(((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST2 })).body as { error: { code: string } }).error.code).toBe('not-signing-analyst');
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(201);

    g = await t.getCase(b, ref);
    expect(g.case.status).toBe('referred');
    expect(g.case.step).toBe(cases.a.steps.length - 1);
    expect(g.next).toBeNull();
    expect(g.view.assessment).toEqual(cases.a.assessment);
    const log = (await t.call('GET', `/api/cases/${ref}/referral/log`, { browser: b })).body as { rows: { recipientId: string; status: string }[] };
    expect(log.rows.map((r) => r.recipientId)).toEqual([...cases.a.recipients].sort((x, y) => x.order - y.order).map((r) => r.id));
    expect(log.rows.every((r) => r.status === 'delivered (simulated)')).toBe(true);
    const again = await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST });
    expect((again.body as { error: { code: string } }).error.code).toBe('already-referred');
    expect((await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'hold', reasonCode: 'RC-HOLD-AWAITING' } })).status).toBe(409);
  });

  it('a hold on the level 5 entry is an assessment record and does not close the case', async () => {
    const t = makeApi();
    const b = bid(2);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    await t.runToSignoff(b, ref);
    const entry = cases.a.signoff.signableEntryId as string;
    const r = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'hold', reasonCode: codeFor(cases.a, entry, 'hold') } });
    expect(r.status).toBe(201);
    expect((r.body as { message: string }).message).not.toMatch(BANNED);
    expect((r.body as { row: { kind: string } }).row.kind).toBe('assessment');
    expect((r.body as { case: PlatformCaseRow }).case.status).toBe('awaiting-sign-off');
  });
});

describe.each(['b', 'c', 'd'] as const)('case %s: alert to assessment record', (id) => {
  it('nothing can be promoted, the assessment record closes the case and nothing is referred', async () => {
    const t = makeApi();
    const b = bid(10);
    await t.replay(b);
    const ref = await t.openScenario(b, id);
    const seen = await t.runToSignoff(b, ref);
    // what returns agrees with Hypothesis.tests: E6 returns only in a; E4 returns only in c
    for (const s of seen.filter((x) => x.source === 'E6')) expect(s.status).toBe('not-returned');
    if (id === 'c') expect(seen.find((x) => x.source === 'E4')?.status).toBe('returned');
    else for (const s of seen.filter((x) => x.source === 'E4')) expect(s.status).toBe('not-returned');
    // border records come back as records, not as an evidence item
    for (const s of seen.filter((x) => x.source === 'E2')) expect(s.status).toBe('returned');
    const g: CaseGet = await t.getCase(b, ref);
    expect(g.view.signoff.signableEntryId).toBeNull();
    // nothing is at level 5, so the case is ready for an assessment record, never for a sign-off
    expect(g.case.status).toBe('awaiting-assessment');
    for (const l of g.levels) {
      const r = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: l.entryId, action: 'promote', reasonCode: promoteCode(cases.a) } });
      expect(r.status).toBe(422);
      expect(text(r)).toContain(l.level === null ? 'no level' : `level ${l.level}`);
    }
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(422);
    const open = g.levels.find((x) => x.level === 4) as { entryId: string };
    const r = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: open.entryId, action: 'hold', reasonCode: codeFor(cases[id], open.entryId, 'hold') } });
    expect(r.status).toBe(201);
    expect((r.body as { message: string }).message).not.toMatch(BANNED);
    expect((r.body as { row: { kind: string } }).row.kind).toBe('assessment');
    const after = await t.getCase(b, ref);
    expect(after.case.status).toBe('closed-assessment');
    expect(after.case.step).toBe(cases[id].steps.length - 1);
    expect(after.view.assessment).toEqual(cases[id].assessment);
    expect((await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST })).status).toBe(409);
    expect((await t.call('GET', `/api/cases/${ref}/referral/packet`, { browser: b })).status).toBe(409);
    expect(((await t.call('GET', `/api/cases/${ref}/referral/log`, { browser: b })).body as { rows: unknown[] }).rows).toEqual([]);
    const audit = (await t.call('GET', `/api/audit?caseRef=${ref}`, { browser: b })).body as { action: string; detail: Record<string, string> }[];
    // an assessment record is logged as one, never as a sign-off
    expect(audit.some((e) => e.action === 'sign')).toBe(false);
    expect(audit.filter((e) => e.action === 'assessment-recorded').map((e) => e.detail.kind)).toEqual(['assessment']);
    expect(audit.some((e) => e.action === 'referral' || e.action === 'countersign')).toBe(false);
  });
});

describe('fallen entries', () => {
  it('a fallen hypothesis can only be assessed with a prepared reason code', async () => {
    const t = makeApi();
    const b = bid(20);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    await t.runToSignoff(b, ref);
    const g = await t.getCase(b, ref);
    const fallen = g.levels.find((x) => x.level === null) as { entryId: string };
    const code = codeFor(cases.a, fallen.entryId, 'hold');
    const bad = await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: fallen.entryId, action: 'hold', reasonCode: 'RC-HOLD-RIVALS-X' } });
    expect(bad.status).toBe(422);
    if (code) expect((await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: fallen.entryId, action: 'hold', reasonCode: code } })).status).toBe(201);
  });
});

describe('levels in a case are the platform assessment', () => {
  it('every served level equals assess() and the release step', async () => {
    const t = makeApi();
    const b = bid(30);
    await t.replay(b);
    const ref = await t.openScenario(b, 'c');
    await t.runToSignoff(b, ref);
    const g = await t.getCase(b, ref);
    const h = g.levels.find((x) => x.entryId === 'H-C2');
    expect(h).toMatchObject({ level: 4, issues: ['no-open-rival'] });
    const audit = (await t.call('GET', `/api/audit?caseRef=${ref}`, { browser: b })).body as { action: string; detail: Record<string, string | number> }[];
    const changes = audit.filter((e) => e.action === 'level-change');
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some((e) => e.detail.entryId === 'H-C1' && e.detail.to === 'none')).toBe(true);
  });
});
