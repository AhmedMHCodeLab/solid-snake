// The referral packet as an intelligence product, served only after both signatures on a level 5 entry.
import { describe, expect, it } from 'vitest';
import { ABOUT, CLOSING, HANDLING } from '../../server/api/packet';
import { RESERVED_WORDS } from '../../shared/types';
import { ANALYST, SUPERVISOR, bid, cases, makeApi, promoteCode } from './helpers';

const FORBIDDEN_NAMES = /Ooredoo|Vodafone|\bCRA\b|Communications Regulatory Authority|Ministry|Police|Interpol/i;

async function referred() {
  const t = makeApi();
  const b = bid(1);
  await t.replay(b);
  const ref = await t.openScenario(b, 'a');
  await t.runToSignoff(b, ref);
  const entry = cases.a.signoff.signableEntryId as string;
  const before = await t.call('GET', `/api/cases/${ref}/referral/packet`, { browser: b });
  await t.call('POST', `/api/cases/${ref}/signoff`, { browser: b, user: ANALYST, body: { entryId: entry, action: 'promote', reasonCode: promoteCode(cases.a) } });
  await t.call('POST', `/api/cases/${ref}/supervisor`, { browser: b, user: SUPERVISOR, body: { entryId: entry, checks: t.allChecks(cases.a) } });
  // both signatures exist, the referral has not been sent: there is still no packet
  const signedOnly = await t.call('GET', `/api/cases/${ref}/referral/packet`, { browser: b });
  await t.call('POST', `/api/cases/${ref}/referral`, { browser: b, user: ANALYST });
  const pk = await t.call('GET', `/api/cases/${ref}/referral/packet`, { browser: b });
  return { t, b, ref, before, signedOnly, pk, html: pk.body as string };
}

describe('referral packet', async () => {
  const { ref, before, signedOnly, pk, html, t, b } = await referred();

  it('is refused before the signatures and before the referral, and served after it as a strict attachment', () => {
    expect([before.status, (before.body as { error: { code: string } }).error.code]).toEqual([409, 'not-referred']);
    expect([signedOnly.status, (signedOnly.body as { error: { code: string } }).error.code]).toEqual([409, 'not-referred']);
    expect(pk.status).toBe(200);
    expect(pk.headers).toMatchObject({
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `attachment; filename="SIMULATED-referral-${ref}.html"`,
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
      'x-content-type-options': 'nosniff',
    });
  });

  it('is built from what the case has released: the closing assessment in the packet is the one in the released view', async () => {
    const view = ((await t.call('GET', `/api/cases/${ref}`, { browser: b })).body as { view: { assessment: { captions: { text: string }[] } | null } }).view;
    expect(view.assessment).not.toBeNull();
    for (const k of (view.assessment as { captions: { text: string }[] }).captions) expect(html).toContain(k.text);
  });

  it('carries the intelligence-product structure', () => {
    for (const h of ['Case', 'Key judgements', 'Evidence and levels', 'Collection gaps', 'Not established', 'Sign-off', 'Dissemination', 'Handling']) expect(html).toContain(`</span> ${h}</h2>`);
    expect(html).toContain(ref);
    expect(html).toContain(cases.a.meta?.originator as string);
    expect(html).toContain((cases.a.meta?.tasking as string).replace(/'/g, '&#39;'));
    for (const k of cases.a.assessment.captions) expect(html).toContain(k.text);
    expect(html).toMatch(/Level 5, Verified finding/);
    const notObserved = cases.a.expectations.filter((x) => x.timeline.at(-1)?.state === 'not-observed');
    expect(notObserved.length).toBeGreaterThan(0);
    for (const x of notObserved) expect(html).toContain(x.what.replace(/'/g, '&#39;').replace(/"/g, '&quot;'));
    expect(html).toContain('Analyst 1, analyst');
    expect(html).toContain('Supervisor 1, supervisor');
  });

  it('lists every recipient as a simulated role, in order, and names no real body', () => {
    const items = [...html.slice(html.indexOf('class="dissemination"')).matchAll(/<li>([^<]*)<\/li>/g)].map((m) => m[1]);
    expect(items).toEqual([...cases.a.recipients].sort((x, y) => x.order - y.order).map((r) => `${r.title} (simulated role)`));
    expect(html).not.toMatch(FORBIDDEN_NAMES);
  });

  it('has the handling line, the closing and the About line exactly once', () => {
    expect(html.split(HANDLING).length - 1).toBe(2);
    expect(html.split(ABOUT).length - 1).toBe(1);
    expect(html.split(CLOSING).length - 1).toBe(1);
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });

  it('holds no script, link, address or long digit run, and keeps reserved words inside level 5 entries', () => {
    expect(html).not.toMatch(/<script|<img|<a |<link|<iframe|src=|href=|url\(/i);
    expect(html).not.toMatch(/https?:\/\/|mailto:|@|www\./i);
    expect(html).not.toMatch(/\d{7,}/);
    expect(html).not.toMatch(new RegExp(String.fromCharCode(0x2014)));
    const level5 = [...html.matchAll(/<article class="entry" data-entry="[^"]+" data-level="5">[\s\S]*?<\/article>/g)].map((m) => m[0]);
    const outside = level5.reduce((rest, a) => rest.replace(a, ''), html).replace(/Key judgements[\s\S]*?<\/section>/, '');
    for (const w of RESERVED_WORDS) expect(outside.toLowerCase()).not.toContain(w);
  });
});
