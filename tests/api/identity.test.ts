// A scenario's identity is not discoverable from anything the API serves or writes: record ids, alerts, responses and
// audit events carry no scenario letter, case code or scenario field. The binding lives on the server only.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANALYST, SUPERVISOR, bid, cases, makeApi, promoteCode, text } from './helpers';

// Any trace of a scenario letter: a record id stream (REC-A-), a case code (SS-A), a scenario or caseId field.
const TRACE = /\b(?:REC|IBCF)-[A-D]-|\bSS-[A-D]\b|"scenario"|"caseId"/;
// Before a case is opened, nothing the analyst can see may carry a letter at all, shape ids included.
const BEFORE_OPEN = new RegExp(`${TRACE.source}|\\bSH-[A-D]-`);
// Inside an opened case, the case's own entry and shape ids (H-A1, SH-A-obs) keep their authored form: the analyst has
// already chosen that case, and no letter maps to an outcome in anything served or bundled.

describe('scenario identity stays on the server', () => {
  it('shows nothing of it in the alert queue, the session, the feed status, the audit list or a record id', async () => {
    const t = makeApi();
    const b = bid(1);
    await t.replay(b);
    for (const url of ['/api/alerts', '/api/session', '/api/feed/status', '/api/audit']) {
      const r = await t.call('GET', url, { browser: b, user: ANALYST });
      expect(r.status, url).toBe(200);
      expect(text(r), url).not.toMatch(BEFORE_OPEN);
    }
  });

  it('shows nothing of it in any response or audit line across a whole case, alert to referral', async () => {
    const t = makeApi();
    const b = bid(2);
    await t.replay(b);
    const ref = await t.openScenario(b, 'a');
    await t.runToSignoff(b, ref);
    const entry = cases.a.signoff.signableEntryId as string;
    const seen: [string, string][] = [];
    const get = async (url: string) => seen.push([url, text(await t.call('GET', url, { browser: b, user: ANALYST }))]);
    await get('/api/alerts');
    await get(`/api/cases/${ref}`);
    await get(`/api/cases/${ref}/signoff`);
    await get(`/api/cases/${ref}/records?entry=${entry}&level=1&offset=0&limit=50`);
    await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) } });
    const sup = await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: SUPERVISOR, body: { entryId: entry, checks: t.allChecks(cases.a) } });
    seen.push(['supervisor', text(sup)]);
    const rf = await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST });
    seen.push(['referral', text(rf)]);
    await get(`/api/cases/${ref}/referral/log`);
    await get(`/api/cases/${ref}/referral/packet`);
    await get('/api/audit');
    await get(`/api/cases/${ref}`);
    for (const [url, body] of seen) expect(body, url).not.toMatch(TRACE);
    // the log file itself, line by line: nothing in an event names the scenario
    for (const line of await t.auditLines(b)) expect(line).not.toMatch(TRACE);
    const raw = readFileSync(await t.auditPath(b), 'utf8');
    expect(raw).not.toMatch(/"scenario"|"caseId"/);
  });
});
