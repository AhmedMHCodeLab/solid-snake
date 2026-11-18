// End-to-end: the console against the real platform API (server/api/server.ts), each test in a fresh browser workspace.
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';

const SHOTS = 'e2e/shots';
mkdirSync(SHOTS, { recursive: true });
// Alert titles written by the detection engine for the four scenarios on the current feed.
const TITLES = { a: /group of 8 SIMs/i, b: /group of 50 SIMs/i, c: /group of 24 SIMs/i, d: /burst of calls from one line to number block \+99997/i };
const HANDLING = 'SIMULATED // EXERCISE DATA';
const ABOUT = 'A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners.';
const JARGON = ['S-CSCF', 'IBCF', 'CDR', 'ECGI', 'TAI', 'IMSI', 'IMEI', 'IMPU', 'MSISDN', 'NNI', 'IOI', 'ICID', 'VoLTE', 'M2M', 'MNO'];

function watchErrors(page: Page) {
  const errs: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(String(e)));
  return errs;
}
async function signIn(page: Page, user = 'analyst-1') {
  await page.goto('/');
  await page.click(`[data-user="${user}"]`);
  await page.waitForURL('**/console/');
  await page.waitForSelector('[data-feed="start"]');
}
async function startFeed(page: Page) {
  await page.selectOption('[data-feed="speed"]', { index: 2 });
  await page.click('[data-feed="start"]');
}
async function openCase(page: Page, title: RegExp) {
  const alert = page.locator('[data-alert]', { hasText: title }).first();
  await alert.waitFor({ timeout: 90_000 });
  await alert.locator('[data-open]').click();
  await expect(page.locator('.chead__t')).toBeVisible();
}
/** Take every released action until the case reaches sign-off. Returns how many actions were taken. */
async function toSignoff(page: Page, onEach?: (i: number) => Promise<void>) {
  for (let i = 0; i < 12; i++) {
    const sign = page.locator('[data-sign], [data-assess]');
    const action = page.locator('[data-action]:not([disabled])');
    await expect(sign.or(action).first()).toBeVisible({ timeout: 30_000 });
    if (await sign.count()) return i;
    const label = await action.first().innerText();
    await action.first().click();
    // Wait for the case to move on: sign-off reached, or a different action offered (the request has returned).
    await expect(async () => {
      if (await sign.count()) return;
      const next = page.locator('[data-action]:not([disabled])');
      expect(await next.count()).toBeGreaterThan(0);
      expect(await next.first().innerText()).not.toBe(label);
    }).toPass({ timeout: 45_000, intervals: [250] });
    if (onEach) await onEach(i);
  }
  throw new Error('sign-off not reached');
}
/** The case response the page was drawn from: the platform's recomputed levels. */
const caseJson = (page: Page) => page.evaluate(async () => {
  const ref = decodeURIComponent(location.hash.slice('#case/'.length));
  const r = await fetch(`/api/cases/${encodeURIComponent(ref)}`, { headers: { 'x-browser-id': localStorage.getItem('ss-browser') ?? '', 'x-demo-user': localStorage.getItem('ss-user') ?? '' } });
  return (await r.json()) as { levels: { entryId: string; level: number | null }[] };
});
/** Every level the page draws (register group, claim block, card, level line) equals the server's list. */
async function levelsEqualServer(page: Page) {
  const server = new Map((await caseJson(page)).levels.map((l) => [l.entryId, l.level]));
  expect(server.size).toBeGreaterThan(3);
  const reg = await page.locator('.register[data-level] .entry[data-entry]').evaluateAll((els) => els.map((e) => [(e as HTMLElement).dataset.entry as string, Number((e.closest('.register') as HTMLElement).dataset.level)] as const));
  expect(reg.length).toBeGreaterThan(3);
  for (const [id, level] of reg) expect(level, `register ${id}`).toBe(server.get(id));
  const fallen = await page.locator('.register--fallen .entry[data-entry]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.entry as string));
  for (const id of fallen) expect(server.get(id), `fallen ${id}`).toBeNull();
  // the newest step is open: its claim blocks and cards show the current levels
  const claims = await page.locator('.logstep[open] .claim[data-claim]').evaluateAll((els) => els.map((e) => [(e as HTMLElement).dataset.claim as string, Number((e as HTMLElement).dataset.level), (e.querySelector('.claim__level') as HTMLElement).innerText] as const));
  for (const [id, level, text] of claims) { expect(level, `claim ${id}`).toBe(server.get(id)); expect(text).toMatch(new RegExp(`^Level ${level}, `, 'i')); }
  const cards = await page.locator('.logstep[open] .card[data-bound][data-level]').evaluateAll((els) => els.map((e) => [(e as HTMLElement).dataset.bound as string, Number((e as HTMLElement).dataset.level), !!(e as HTMLElement).dataset.fallen] as const));
  for (const [id, level, fell] of cards) expect(fell ? 4 : level, `card ${id}`).toBe(fell ? 4 : server.get(id));
}
const visibleText = (page: Page, sel: string) => page.locator(sel).evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText).join('\n'));
/** Every visible map label sits wholly inside the map frame. */
async function tagsInFrame(page: Page) {
  const r = await page.evaluate(() => {
    const f = document.getElementById('map')!.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.cmap__tag')].filter((t) => t.offsetWidth > 0).map((t) => { const b = t.getBoundingClientRect(); return { text: t.innerText, ok: b.left >= f.left - 0.5 && b.right <= f.right + 0.5 && b.top >= f.top - 0.5 && b.bottom <= f.bottom + 0.5 }; });
  });
  expect(r.length).toBeGreaterThan(0);
  expect(r.filter((t) => !t.ok).map((t) => t.text)).toEqual([]);
}
/** Narrow screens: the map controls are one row of buttons inside the map band, clear of the next-action card. */
async function controlsCompact(page: Page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await page.evaluate(() => {
    const st = document.querySelector('.stage')!.getBoundingClientRect();
    const bs = [...document.querySelectorAll<HTMLElement>('.mapctl__b')].map((b) => b.getBoundingClientRect());
    const next = document.querySelector('.nextbar')?.getBoundingClientRect();
    return { rowSpread: Math.max(...bs.map((b) => b.top)) - Math.min(...bs.map((b) => b.top)), maxH: Math.max(...bs.map((b) => b.height)), inside: bs.every((b) => b.top >= st.top && b.bottom <= st.bottom && b.left >= st.left && b.right <= st.right), clear: next ? st.bottom <= next.top + 0.5 : true };
  });
  expect(r.rowSpread).toBeLessThan(2);
  expect(r.maxH).toBeLessThanOrEqual(40);
  expect(r.inside).toBe(true);
  expect(r.clear).toBe(true);
}
async function axe(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => `${label}: ${v.id} ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

test('entry and About pages: handling line, About line, axe', async ({ page }) => {
  const errs = watchErrors(page);
  for (const path of ['/', '/about/']) {
    await page.goto(path);
    await expect(page.locator('.handling--top')).toHaveText(HANDLING);
    await expect(page.locator('.handling--bottom')).toHaveText(HANDLING);
    await expect(page.getByText(ABOUT, { exact: true }).first()).toBeVisible();
    await axe(page, path);
  }
  expect(errs).toEqual([]);
});

for (const vp of [{ w: 1440, h: 900 }, { w: 1024, h: 768 }, { w: 390, h: 844 }]) {
  test(`case A end to end at ${vp.w}: monitor, open, rise, sign-off, countersign, referral, audit`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const errs = watchErrors(page);
    await signIn(page);
    await startFeed(page);
    await page.locator('[data-alert]', { hasText: TITLES.a }).first().waitFor({ timeout: 90_000 });
    // The monitor map is not dead: the queued alert's region is drawn as a hatched area with a label, and the light is on it.
    await expect(page.locator('.cmap__nat .area--region:not([hidden]) .area__fill').first()).toHaveAttribute('fill', 'url(#mn-region)');
    await expect(page.locator('.cmap__tag').first()).toContainText('area of stated uncertainty');
    await tagsInFrame(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}/${vp.w}-1-monitor.png` });
    await openCase(page, TITLES.a);
    await page.waitForTimeout(2200);
    await expect(page.locator('.cmap__case')).toHaveAttribute('visibility', 'visible');
    await page.screenshot({ path: `${SHOTS}/${vp.w}-2-open.png` });
    await toSignoff(page, async (i) => {
      if (i === 0) {
        await page.waitForTimeout(1300);
        await page.screenshot({ path: `${SHOTS}/${vp.w}-3-level-rise.png` });
        await tagsInFrame(page);
        if (vp.w < 560) await controlsCompact(page);
        // Every zoom keeps labels inside the frame.
        for (const f of ['in', 'in', 'in', 'out', 'out', 'out', 'out', 'reset']) { await page.click(`[data-zoom="${f}"]`); await tagsInFrame(page); }
      }
      if (i === 5) { await page.waitForTimeout(1800); await page.screenshot({ path: `${SHOTS}/${vp.w}-4-test.png` }); }
    });
    await page.locator('[data-sign]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${vp.w}-5-sign-off.png` });
    await page.click('[data-sign]');
    await expect(page.locator('.chead__dl')).toContainText('Awaiting countersignature');
    // The seal is released by the countersignature, not by the analyst's promotion.
    await expect(page.locator('.cmap__case .seal')).toHaveCount(0);
    await page.selectOption('#acct', 'supervisor-1');
    await page.locator('input[name="check"]').first().waitFor();
    for (const c of await page.locator('.chooser__opt:has(input[name="check"])').all()) await c.click();
    await page.click('[data-countersign]');
    await expect(page.locator('.cmap__case .seal')).toHaveCount(1);
    // Only the analyst who signed disseminates the referral.
    await page.selectOption('#acct', 'analyst-2');
    await expect(page.locator('[data-refer]')).toBeDisabled();
    await expect(page.locator('#refer-why')).toContainText('Only the analyst who signed');
    await page.selectOption('#acct', 'analyst-1');
    await expect(page.locator('[data-packet]')).toHaveCount(0);
    await page.locator('[data-refer]').click();
    await expect(page.locator('.chain__i.is-sent')).toHaveCount(4);
    await page.locator('.nextbar--refer').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${vp.w}-6-referral.png` });
    const dl = page.waitForEvent('download');
    await page.locator('[data-packet]').first().click();
    expect((await dl).suggestedFilename()).toMatch(/^SIMULATED-referral-/);
    await page.click('[data-tab="audit"]');
    await expect(page.locator('.verify')).toContainText('Chain verified');
    await page.screenshot({ path: `${SHOTS}/${vp.w}-7-audit.png` });
    expect(errs).toEqual([]);
  });
}

test('monitor: an alert draws its region on the national plate and says so; no markers, no region without an alert', async ({ page }) => {
  const errs = watchErrors(page);
  await page.addInitScript(() => {
    (window as unknown as { __live: string[] }).__live = [];
    addEventListener('DOMContentLoaded', () => { const el = document.getElementById('live'); if (el) new MutationObserver(() => { if (el.textContent) (window as unknown as { __live: string[] }).__live.push(el.textContent); }).observe(el, { childList: true, characterData: true, subtree: true }); });
  });
  await signIn(page);
  await expect(page.locator('.cmap__nat .area--region:not([hidden])')).toHaveCount(0);
  await expect(page.locator('.cmap__tag')).toHaveCount(0);
  await startFeed(page);
  await page.locator('[data-alert]').first().waitFor({ timeout: 90_000 });
  await expect(page.locator('.cmap__nat .area--region:not([hidden])').first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __live: string[] }).__live.join(' | '))).toMatch(/Alert ALR-\d{4}: region R drawn on the national plate\./);
  await expect(page.locator('.alert').first()).not.toContainText('once a case holds it');
  // Never a point or marker on the monitor plate: no circle outside the spotlight masks.
  expect(await page.locator('.cmap__svg circle').evaluateAll((cs) => cs.filter((c) => !c.closest('mask')).length)).toBe(0);
  // Hovering a queued alert moves the light to its region.
  const card = page.locator('[data-alert]').first();
  await card.hover();
  await tagsInFrame(page);
  expect(errs).toEqual([]);
});

for (const id of ['b', 'c', 'd'] as const) {
  test(`case ${id.toUpperCase()} through an assessment record, nothing signable`, async ({ page }) => {
    const errs = watchErrors(page);
    await signIn(page);
    await startFeed(page);
    await openCase(page, TITLES[id]);
    await toSignoff(page);
    await expect(page.locator('[data-sign]')).toHaveCount(0);
    await expect(page.locator('.nextbar--sign')).toContainText('Nothing in this case can be signed');
    await page.click('[data-assess]');
    await expect(page.locator('.chead__dl')).toContainText('Closed with an assessment record');
    await expect(page.locator('.outcome')).toContainText('no referral');
    expect(errs).toEqual([]);
  });
}

test('workspace checks on case A: plain first layer, charts, tables, map honesty, levels as text, axe in both themes', async ({ page }) => {
  const errs = watchErrors(page);
  await signIn(page);
  await startFeed(page);
  await axe(page, 'monitor');
  await openCase(page, TITLES.a);
  let steps = 0;
  const check = async () => {
    // Map honesty: no circle outside the spotlight masks except the one verified-site mark, only once verified.
    const circles = await page.locator('.cmap__svg circle').evaluateAll((cs) => cs.filter((c) => !c.closest('mask')).map((c) => ({ site: !!c.closest('.site'), hidden: !!c.closest('[hidden]') })));
    expect(circles.every((c) => c.site)).toBe(true);
    await expect(page.locator('.cmap .handling')).toHaveText(HANDLING);
    // Levels as text in the register and on every claim.
    for (const e of await page.locator('.register .entry:not(.entry--lacuna) .entry__meta').allTextContents()) expect(e).toMatch(/level [1-5], |was/i);
    for (const c of await page.locator('.logstep[open] .claim__level').allTextContents()) expect(c).toMatch(/^level [1-5], /i); // the stylesheet uppercases this line, so match the words, not the case
    steps++;
  };
  await check();
  await toSignoff(page, check);
  await levelsEqualServer(page);
  // Every chart: axis labels, a unit, a source code, and its bound entry's level as text.
  await page.locator('.logstep:not([open]) > summary').evaluateAll((ss) => ss.forEach((s) => (s as HTMLElement).click()));
  const charts = page.locator('.chart:not(.chart--strip)');
  expect(await charts.count()).toBeGreaterThan(3);
  for (const ch of await charts.all()) {
    await expect(ch.locator('.chart__ylab, .chart__colhead, .chart__note--key').first()).not.toBeEmpty();
    await expect(ch.locator('.chart__bind')).toContainText(/Unit:|Line weight|Bound to/);
    await expect(ch.locator('.chart__bind .ref').first()).toHaveText(/^(E[1-7]|[A-Z]-\d+|H-[A-Z]\d+)$/);
    await expect(ch.locator('.chart__bind .levelline__name, .chart__nolevel').first()).toBeVisible();
  }
  // Tables: header cells with scope, keyboard-scrollable region.
  await page.locator('.exhibit[data-kind="records"] [data-show-records]').first().click();
  const tbl = page.locator('.tbl').first();
  await expect(tbl).toBeVisible();
  await expect(tbl).toHaveAttribute('tabindex', '0');
  expect(await tbl.locator('thead th:not([scope="col"])').count()).toBe(0);
  await tbl.focus();
  await page.keyboard.press('ArrowRight');
  // First layer is plain: no abbreviation from the list as a standalone word, and no museum vocabulary.
  const text = await visibleText(page, '#panel-main, #panel-side, .cmap__tags, .mapcap, .topbar');
  for (const j of JARGON) expect(text, `jargon ${j}`).not.toMatch(new RegExp(`(^|[^A-Za-z0-9-])${j.replace('-', '\\-')}([^A-Za-z0-9-]|$)`));
  for (const w of ['museum', 'gallery', 'tombstone', 'fictional']) expect(text.toLowerCase()).not.toContain(w);
  await axe(page, 'case workspace, dark');
  await page.click('#theme');
  await axe(page, 'case workspace, light');
  expect(steps).toBeGreaterThan(5);
  expect(errs).toEqual([]);
});

test('refusals from the service are printed plainly', async ({ page }) => {
  await signIn(page);
  await startFeed(page);
  await openCase(page, TITLES.a);
  await toSignoff(page);
  await page.route('**/signoff', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ simulated: true, error: { code: 'same-user', message: 'The supervisor must be a different user from the analyst who signed.' } }) }) : r.continue()));
  await page.click('[data-sign]');
  await expect(page.locator('.refusal')).toHaveText('The supervisor must be a different user from the analyst who signed.');
  await expect(page.locator('#live')).toContainText('Refused');
});

test('keyboard: skip link, alert queue, map controls and areas, register sheet traps focus at 390', async ({ page }) => {
  await signIn(page);
  await page.keyboard.press('Tab');
  await expect(page.locator('.skip')).toBeFocused();
  await page.keyboard.press('Enter');
  await startFeed(page);
  const open = page.locator('[data-alert]', { hasText: TITLES.a }).locator('[data-open]');
  await open.waitFor({ timeout: 90_000 });
  await open.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.chead__t')).toBeVisible();
  await page.waitForTimeout(2200);
  const g = page.locator('.cmap__case');
  const before = await g.getAttribute('transform');
  await page.locator('#map').focus();
  await page.keyboard.press('+');
  expect(await g.getAttribute('transform')).not.toBe(before);
  await page.keyboard.press('0');
  expect(await g.getAttribute('transform')).toBe(before);
  await page.locator('[data-zoom="in"]').focus();
  await page.keyboard.press('Enter');
  expect(await g.getAttribute('transform')).not.toBe(before);
  await page.locator('#areas > summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('[data-area]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mappanel')).toBeVisible();
  await expect(page.locator('#mappanel-h')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mappanel')).toBeHidden();
  // Narrow: the register is a bar that opens to a modal sheet; focus moves in, Tab stays in, Escape returns it.
  await page.setViewportSize({ width: 390, height: 844 });
  const bar = page.locator('[data-regbar]');
  await bar.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.regsheet__in[role="dialog"]')).toBeVisible();
  await expect(page.locator('[data-regclose]')).toBeFocused();
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.register-sheet'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(bar).toBeFocused();
});

test('collection gaps are reachable from the register within two activations at 390', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await startFeed(page);
  await openCase(page, TITLES.a);
  await page.locator('[data-action]:not([disabled])').first().click();
  await expect(page.locator('[data-regbar]')).toContainText('1 gaps', { timeout: 30_000 });
  await page.click('[data-regbar]');
  await page.click('[data-gaps]');
  await expect(page.locator('[data-gap]').first()).toBeInViewport();
});

test('reduced motion: releases land as stills, nothing mid-tween', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await signIn(page);
  await startFeed(page);
  await openCase(page, TITLES.a);
  const g = page.locator('.cmap__case');
  await expect(g).toHaveAttribute('visibility', 'visible');
  const t0 = await g.getAttribute('transform');
  await page.waitForTimeout(120);
  expect(await g.getAttribute('transform')).toBe(t0);
  await page.locator('[data-action]:not([disabled])').first().click();
  await expect(page.locator('.register[data-level="3"] .entry')).toHaveCount(1, { timeout: 30_000 });
  const t1 = await g.getAttribute('transform');
  await page.waitForTimeout(120);
  expect(await g.getAttribute('transform')).toBe(t1);
  await page.screenshot({ path: `${SHOTS}/1440-reduced-motion.png` });
  await ctx.close();
});

test('the queue is newest first, a background alert is dismissed with a prepared reason, and a twin alert points at its open case', async ({ page }) => {
  const errs = watchErrors(page);
  await signIn(page);
  await startFeed(page);
  await page.locator('[data-alert]', { hasText: TITLES.a }).first().waitFor({ timeout: 90_000 });
  await expect(page.locator('[data-alert]')).not.toHaveCount(0);
  // wait for the whole window to be ingested so the queue holds every alert
  await expect(page.locator('.feed__state')).toContainText('Window replayed', { timeout: 120_000 });
  const times = await page.locator('[data-alert] .alert__time').allTextContents();
  expect(times.length).toBeGreaterThanOrEqual(8);
  expect(times).toEqual([...times].sort().reverse());
  // an ordinary group the generic rules flagged: no connector data, dismissed with a prepared reason
  const depot = page.locator('[data-alert]', { hasText: /group of 7 SIMs/i }).first();
  await expect(depot.locator('[data-open]')).toHaveCount(1);
  await depot.locator('details.dismiss > summary').click();
  await depot.locator('[data-dismiss][data-reason="DIS-KNOWN-ACTIVITY"]').click();
  await expect(page.locator('[data-alert]', { hasText: /group of 7 SIMs/i }).first()).toContainText('Dismissed');
  // the alert states how it was derived
  await expect(page.locator('[data-alert]').first()).toContainText('Baseline read from');
  // two alerts on the same evidence: opening one points the other at its case
  await openCase(page, TITLES.a);
  const ref = (await page.locator('.chead__dl').innerText()).match(/TFIU-\d{4}-\d{4}/)![0];
  await page.goto('/console/#monitor');
  const twin = page.locator('[data-alert]', { hasText: /Inbound international traffic on route TG-IPX5-IN-03/ }).first();
  await expect(twin.locator('.alert__link')).toContainText(ref);
  await expect(twin.locator('[data-open]')).toHaveCount(0);
  expect(errs).toEqual([]);
});

test('changing the replay speed while the feed runs applies it and the audit trail says so', async ({ page }) => {
  await signIn(page);
  await page.selectOption('[data-feed="speed"]', { index: 0 });
  await page.click('[data-feed="start"]');
  await expect(page.locator('.feed__state')).toContainText('Running');
  await page.selectOption('[data-feed="speed"]', { index: 2 });
  await expect.poll(async () => page.evaluate(async () => {
    const r = await fetch('/api/audit', { headers: { 'x-browser-id': localStorage.getItem('ss-browser') ?? '', 'x-demo-user': localStorage.getItem('ss-user') ?? '' } });
    return ((await r.json()) as { action: string }[]).filter((e) => e.action === 'feed-speed').length;
  })).toBe(1);
});
