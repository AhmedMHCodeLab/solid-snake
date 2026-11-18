// The design-system page at /system/. Static: everything is drawn once from the same builders the experience will use.
import gsap from 'gsap';
import '../styles/index.css';
import './system.css';
import { LEVEL_NAMES, STAGE_NAMES, type Basis, type Level } from '../../../shared/types';
import { defsSprite, lacunaBracket, levelLabel, levelMark, STROKES_BY_LEVEL } from '../ui/marks';
import { ANIMATED_CHANGES, DURATION, EASE, MOTION_BY_CHANGE } from '../ui/motion';
import {
  REGION_CENTRE, SAMPLE_CARD, SAMPLE_CATALOGUE, basis, card, casePlate, catalogue, claim, context, esc, levelline, limit, nationalPlate, stagerail, v,
} from './parts';

const root = document.getElementById('app')!;

// ---- contrast ----------------------------------------------------------------------------------------------------
const lin = (c: number) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const lum = (rgb: number[]) => 0.2126 * lin(rgb[0]!) + 0.7152 * lin(rgb[1]!) + 0.0722 * lin(rgb[2]!);
const hex = (h: string) => { const n = parseInt(h.trim().slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const ratio = (a: number[], b: number[]) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

type Theme = 'dark' | 'light';
function tokens(theme: Theme): Record<string, string> {
  const probe = document.createElement('div');
  probe.dataset.theme = theme;
  probe.style.cssText = 'position:absolute;visibility:hidden';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const names = ['wall', 'wall-2', 'wall-text', 'wall-dim', 'wall-rule', 'wall-rule-strong', 'hatch-wall', 'paper', 'plate', 'paper-dim', 'ink', 'graphite', 'rule', 'construction', 'oxide'];
  const out: Record<string, string> = {};
  for (const n of names) out[n] = cs.getPropertyValue(`--${n}`).trim();
  out['veil-a'] = cs.getPropertyValue('--veil-a').trim();
  probe.remove();
  return out;
}
const veiled = (plate: number[], a: number) => plate.map((c) => Math.round(c * (1 - a)));

interface Pair { name: string; fg: string; bg: string; need: 4.5 | 3 | 0; kind: string; veil?: boolean }
const PAIRS: Pair[] = [
  { name: 'Wall text on wall', fg: 'wall-text', bg: 'wall', need: 4.5, kind: 'text' },
  { name: 'Wall dim on wall', fg: 'wall-dim', bg: 'wall', need: 4.5, kind: 'text' },
  { name: 'Wall rule strong on wall', fg: 'wall-rule-strong', bg: 'wall', need: 3, kind: 'graphic' },
  { name: 'Wall hatch on wall (lacuna slot)', fg: 'hatch-wall', bg: 'wall', need: 3, kind: 'graphic' },
  { name: 'Ink on paper', fg: 'ink', bg: 'paper', need: 4.5, kind: 'text' },
  { name: 'Graphite on paper', fg: 'graphite', bg: 'paper', need: 4.5, kind: 'text' },
  { name: 'Construction blue on paper', fg: 'construction', bg: 'paper', need: 4.5, kind: 'text' },
  { name: 'Oxide on paper (sign-off)', fg: 'oxide', bg: 'paper', need: 4.5, kind: 'text' },
  { name: 'Ink on plate', fg: 'ink', bg: 'plate', need: 4.5, kind: 'text' },
  { name: 'Graphite on plate', fg: 'graphite', bg: 'plate', need: 4.5, kind: 'text' },
  { name: 'Construction blue on plate', fg: 'construction', bg: 'plate', need: 4.5, kind: 'text' },
  { name: 'Ink on unlit card (paper-dim)', fg: 'ink', bg: 'paper-dim', need: 4.5, kind: 'text' },
  { name: 'Graphite on unlit card', fg: 'graphite', bg: 'paper-dim', need: 4.5, kind: 'text' },
  { name: 'Construction blue on unlit card', fg: 'construction', bg: 'paper-dim', need: 4.5, kind: 'text' },
  { name: 'Oxide on unlit card', fg: 'oxide', bg: 'paper-dim', need: 4.5, kind: 'text' },
  { name: 'Ink on unlit plate (map labels)', fg: 'ink', bg: 'plate', need: 4.5, kind: 'text', veil: true },
  { name: 'Construction blue on unlit plate (lines, hatch)', fg: 'construction', bg: 'plate', need: 3, kind: 'graphic', veil: true },
  { name: 'Graphite on unlit plate (dashes, hatch)', fg: 'graphite', bg: 'plate', need: 3, kind: 'graphic', veil: true },
  { name: 'Rule on paper (hairline, decorative)', fg: 'rule', bg: 'paper', need: 0, kind: 'info' },
  { name: 'Paper on wall (artefact against wall)', fg: 'paper', bg: 'wall', need: 0, kind: 'info' },
];
function contrast(theme: Theme, p: Pair): number {
  const t = tokens(theme);
  const a = hex(t[p.fg]!);
  const b = p.veil ? veiled(hex(t[p.bg]!), parseFloat(t['veil-a']!)) : hex(t[p.bg]!);
  return ratio(a, b);
}
const contrastData = PAIRS.map((p) => ({ ...p, dark: contrast('dark', p), light: contrast('light', p) }));
(window as unknown as { __contrast: unknown }).__contrast = contrastData.map((r) => ({ name: r.name, need: r.need, dark: +r.dark.toFixed(2), light: +r.light.toFixed(2) }));

const verdict = (r: number, need: number) => (need === 0 ? 'info' : r >= need ? 'pass' : 'FAIL');
const contrastTable = `<table class="ctable"><caption class="sr-only">Measured contrast ratios in both themes</caption>
  <thead><tr><th scope="col">Pair</th><th scope="col">Needs</th><th scope="col">Dark</th><th scope="col">Light</th></tr></thead><tbody>
  ${contrastData.map((r) => `<tr><th scope="row">${esc(r.name)}<span class="ctable__kind">${r.kind}</span></th><td class="ctable__n">${r.need ? r.need + ':1' : 'none'}</td>
    <td class="ctable__n"><b>${r.dark.toFixed(2)}</b> ${verdict(r.dark, r.need)}</td><td class="ctable__n"><b>${r.light.toFixed(2)}</b> ${verdict(r.light, r.need)}</td></tr>`).join('')}
  </tbody></table>`;

// ---- swatches ----------------------------------------------------------------------------------------------------
const swatch = (name: string, role: string, value: string, theme?: Theme) =>
  `<li class="sw"><span class="sw__chip" style="background:var(--${name})"></span><span class="sw__name">${name}</span><span class="sw__hex v">${value}</span><span class="sw__role">${role}</span></li>`;
function swatches(theme: Theme): string {
  const t = tokens(theme);
  const wall: [string, string][] = [['wall', 'Gallery ground'], ['wall-2', 'Raised wall'], ['wall-text', 'Wall text (Bone)'], ['wall-dim', 'Secondary wall text (Dim)'], ['wall-rule', 'Hairlines on the wall'], ['wall-rule-strong', 'Meaningful lines on the wall']];
  return `<ul class="sws" data-theme="${theme}">${wall.map(([n, r]) => swatch(n, r, t[n]!)).join('')}</ul>`;
}
const artefactSwatches = (() => {
  const t = tokens('dark');
  const a: [string, string][] = [['paper', 'Sheets and slips'], ['plate', 'Map plate ground'], ['paper-dim', 'The same sheet, unlit'], ['ink', 'Text and established marks'], ['graphite', 'Dashed strokes, secondary text'], ['rule', 'Hairlines only'], ['construction', 'Derived marks, construction lines'], ['oxide', 'One use: the level 5 sign-off']];
  return `<ul class="sws sws--artefact">${a.map(([n, r]) => swatch(n, r, t[n]!)).join('')}</ul>`;
})();

// ---- compositions -------------------------------------------------------------------------------------------------
function still(theme: Theme, id: string): string {
  const lacunaSurface = theme === 'light' ? 'wall-light' : 'wall';
  return `<div class="app app--still" data-theme="${theme}" role="group" aria-label="Composed still, ${theme} theme">
    <div class="app__frame">
      <div class="app__map"><div class="plate-box">${nationalPlate({ id, spot: { x: REGION_CENTRE[0] + 6, y: REGION_CENTRE[1] + 70, r: 215 }, region: true })}</div></div>
      <div class="app__wall">
        <div class="brand"><span class="brand__name">Solid Snake</span><span class="brand__case">Specimen case &middot; exercise data</span></div>
        <header class="stagehead"><span class="stagehead__num" aria-hidden="true">2</span><div><p class="stagehead__kicker">Stage 2 of 7</p><h2 class="stagehead__name">Evidence</h2></div>
          <p class="stagehead__lede">Two systems recorded the same group. Each says what it saw, and what it did not.</p></header>
        ${limit(`Inbound sessions on route ${v('R')} were expected and were not observed. That narrows the story. It does not close it.`, 'Expected, not observed', lacunaSurface)}
      </div>
      <div class="app__cards">${card(SAMPLE_CARD)}</div>
      <div class="app__rail">${stagerail(2, `Case progress, ${id}`)}</div>
      <div class="app__catalogue">${catalogue(SAMPLE_CATALOGUE, { id: `cat-${id}`, label: `Catalogue, still ${id}` })}</div>
    </div>
  </div>`;
}
function mobileStill(theme: Theme, id: string, open = false): string {
  const lacunaSurface = theme === 'light' ? 'wall-light' : 'wall';
  return `<div class="app app--box" data-theme="${theme}" style="--box-h:760px" role="group" aria-label="Mobile composition, ${theme} theme, ${id}">
    <div class="app__frame">
      <div class="app__rail">${stagerail(2, `Case progress, ${id}`)}</div>
      <div class="app__map"><div class="plate-box">${nationalPlate({ id, spot: { x: REGION_CENTRE[0] + 6, y: REGION_CENTRE[1] + 70, r: 215 }, region: true, tags: false })}</div></div>
      <div class="app__wall">
        <header class="stagehead"><span class="stagehead__num" aria-hidden="true">2</span><div><p class="stagehead__kicker">Stage 2 of 7</p><h2 class="stagehead__name">Evidence</h2></div>
          <p class="stagehead__lede">Two systems recorded the same group. Each says what it saw, and what it did not.</p></header>
        ${limit(`Inbound sessions on route ${v('R')} were expected and were not observed.`, 'Expected, not observed', lacunaSurface)}
      </div>
      <div class="app__cards">${card(SAMPLE_CARD)}</div>
      <div class="app__catalogue">${catalogue(SAMPLE_CATALOGUE, { id: `cat-${id}`, open, label: `Catalogue, mobile ${id}` })}</div>
    </div>
  </div>`;
}

// ---- sections -----------------------------------------------------------------------------------------------------
const section = (n: string, id: string, title: string, lede: string, body: string, wide = false) => wide ? `
<section class="sys-section" id="${id}" aria-labelledby="${id}-h">
  <div class="wrap"><header class="sys-section__head sys-section__head--wide"><p class="sys-n">${n}</p><h2 class="sys-title" id="${id}-h">${title}</h2><p class="sys-lede">${lede}</p></header></div>
  <div class="sys-section__full">${body}</div>
</section>` : `
<section class="sys-section" id="${id}" aria-labelledby="${id}-h">
  <div class="wrap grid">
    <header class="sys-section__head col-3"><p class="sys-n">${n}</p><h2 class="sys-title" id="${id}-h">${title}</h2><p class="sys-lede">${lede}</p></header>
    <div class="sys-section__body col-9">${body}</div>
  </div>
</section>`;
const sub = (t: string, body: string) => `<div class="sys-sub"><h3 class="sys-sub__t">${t}</h3>${body}</div>`;

const principles = `<ol class="principles">
  <li><b>Light means attention.</b> The spotlight is light falling on an artefact. Nothing on screen is itself a light source, so nothing glows. A level 1 record and a level 5 finding are lit the same way.</li>
  <li><b>Level is a mark.</b> Every claim carries a numeral, the level name in words, and a shape. Colour, brightness and motion never carry it.</li>
  <li><b>Uncertainty is hatching.</b> An area we are not sure of is drawn as lines, with a dashed limit. There is no gradient and no point except the one verified-site mark.</li>
  <li><b>Absence is drawn.</b> What was expected and not observed has its own form: brackets around an empty hatched slot.</li>
  <li><b>One motion rule.</b> Only level changes, stage changes, map changes and the moving spotlight animate. Everything else is instant.</li>
</ol>`;

const colourBody = `
${sub('Wall: dark (default)', swatches('dark'))}
${sub('Wall: light', swatches('light'))}
${sub('Artefacts: the same in both themes', artefactSwatches)}
${sub('Measured contrast, both themes', `<p class="sys-note">Computed in this page from the live tokens, WCAG 2.2 relative luminance. Text pairs need 4.5:1. Meaningful graphics need 3:1. The unlit rows apply the veil (30% black) the way the spotlight does.</p>${contrastTable}`)}`;

const typeBody = `
<div class="spec">
  <div class="spec__row"><span class="spec__k t-label">Display</span><p class="t-display">3</p><span class="spec__m v">Newsreader 300, clamp 56 to 144 px</span></div>
  <div class="spec__row"><span class="spec__k t-label">H1</span><p class="t-h1">Rivals on the wall</p><span class="spec__m v">300, clamp 40 to 80 px</span></div>
  <div class="spec__row"><span class="spec__k t-label">H2</span><p class="t-h2">What the records show</p><span class="spec__m v">350, clamp 30 to 48 px</span></div>
  <div class="spec__row"><span class="spec__k t-label">H3</span><p class="t-h3">A second source arrives</p><span class="spec__m v">400, clamp 22 to 30 px</span></div>
  <div class="spec__row"><span class="spec__k t-label">Lede</span><p class="t-lede">Two systems recorded the same group. Each says what it saw, and what it did not.</p><span class="spec__m v">350, clamp 20 to 26 px</span></div>
  <div class="spec__row"><span class="spec__k t-label">Body</span><p class="t-body prose">Record ${v('SPECIMEN-000042')} shows ${v('SPECIMEN-SUB-0412')} originating ${v('412')} sessions on cell ${v('SPECIMEN-CELL-07')}. A value quoted from a record is set in mono inside the sentence.</p><span class="spec__m v">400, 16 to 18 px, 58ch</span></div>
  <div class="spec__row"><span class="spec__k t-label">Hypothesis</span><p class="t-body t-hyp prose">Hypothesis ${v('H-1')}: a specimen explanation. Rival: a second specimen explanation. Test: an outside check ${v('E6')}. Roman is for what is established, italic for what is proposed.</p><span class="spec__m v">Newsreader italic</span></div>
  <div class="spec__row"><span class="spec__k t-label">Label</span><p class="t-label">Collection point &middot; 11 to 12 px</p><span class="spec__m v">Plex Mono 500, caps, 0.08em</span></div>
  <div class="spec__row"><span class="spec__k t-label">Record</span><p class="v v--wrap" style="font-size:1rem">SPECIMEN-000042 &nbsp; SPECIMEN-CELL-07 &nbsp; 2031-03-01T04:12:09Z</p><span class="spec__m v">Plex Mono 400, slashed zero, tabular</span></div>
</div>
${sub('The weight axis carries "settled"', `<p class="sys-note">A claim that is not yet settled is set at weight ${'300'}. When its level is reached it settles to ${'480'} on the same variable axis. Nothing is added or removed.</p>
<div class="axis">${[300, 380, 480, 600].map((w) => `<p class="axis__s settle" style="--wt:${w}">Correlated evidence <span class="v">${w}</span></p>`).join('')}</div>`)}`;

const gridBody = `
${sub('Twelve columns', `<div class="gridfig" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<span>${i + 1}</span>`).join('')}</div><p class="sys-note">Margin clamp(16, 3.4vw, 48) px, gutter clamp(12, 1.6vw, 24) px, maximum width 1440 px. Under 820 px every column is full width.</p>`)}
${sub('Spacing scale', `<ul class="spacing">${[['s1', 4], ['s2', 8], ['s3', 12], ['s4', 16], ['s5', 24], ['s6', 32], ['s7', 48], ['s8', 64], ['s9', 96], ['s10', 128]].map(([n, px]) => `<li><span class="v">--${n}</span><span class="spacing__bar" style="width:${px}px"></span><span class="v">${px}px</span></li>`).join('')}</ul>`)}
${sub('Shape', `<p class="sys-note">Radius 0, never more than 2 px. Rules are 1 px hairlines; a double rule (1 px, gap, 1 px) heads a tombstone label. Shadows are cast by sheets: one hard contact edge and one long soft fall to the lower right, as if lit from the upper left.</p>`)}`;

const marksBody = (() => {
  const levels: Level[] = [1, 2, 3, 4, 5];
  const rows = levels.map((l) => {
    const lab = levelLabel(l);
    const how: Record<Level, string> = {
      1: 'A corner tick, with the record id beside it.',
      2: 'The tick extends into a graduated measuring rule down the left edge. Baseline stated.',
      3: 'A second rule is tied to the first. Each end names its source; the independence statement is printed.',
      4: 'A dashed frame, open on one side where rivals hang. Text in italic.',
      5: 'The same frame inked solid and closed, with a sign-off line: VERIFIED (SIMULATED).',
    };
    return `<tr><td class="mrow__mark"><span class="onpaper on-paper">${levelMark(l, { size: 72 })}</span></td>
      <td><div class="mrow__sizes on-paper">${[16, 24, 40].map((s) => levelMark(l, { size: s })).join('')}</div></td>
      <th scope="row"><span class="levelline ${l === 4 ? 'levelline--hyp' : ''}"><span class="levelline__num">${lab.numeral}</span><span class="levelline__name">${esc(lab.name)}</span></span><span class="mrow__new v">adds: ${STROKES_BY_LEVEL[l].join(', ')}</span></th>
      <td class="mrow__how">${how[l]}</td></tr>`;
  }).join('');
  return `
${sub('Five marks, cumulative strokes', `<table class="mtable"><caption class="sr-only">The five level marks</caption><thead><tr><th scope="col">Mark</th><th scope="col">At 16, 24, 40 px</th><th scope="col">Level</th><th scope="col">How it is drawn</th></tr></thead><tbody>${rows}</tbody></table>`)}
${sub('Other states', `<div class="states on-paper">
  ${[
    ['fallen', levelMark(4, { size: 64, state: 'fallen' }), 'Fallen', 'The frame is broken and struck. "was 4" stays printed beside it.'],
    ['awaiting', levelMark(1, { size: 64, state: 'awaiting' }), 'Awaiting evidence', 'A dotted frame with nothing inside.'],
    ['unsignable', levelMark(4, { size: 64, state: 'unsignable' }), 'Unsignable', 'The sign-off line is stopped by a bar. Below level 5 nothing can be signed.'],
    ['lacuna', lacunaBracket({ width: 120, height: 48 }), 'Expected, not observed', 'Square brackets around an empty hatched slot. The slot is never filled in.'],
  ].map(([, svg, name, how]) => `<figure class="state"><div class="state__mark">${svg}</div><figcaption><b>${name}</b><span>${how}</span></figcaption></figure>`).join('')}
</div>`)}
${sub('A rise, drawn', `<div class="riser on-paper"><div class="riser__mark" id="riser">${levelMark(3, { size: 96, from: 2 })}</div>
  <div class="riser__text"><p class="levelline-demo" id="riser-line">${levelline(3, 20)}</p><p class="sys-note">Strokes new since level 2 carry <span class="v">.is-new</span>. Only those are drawn; the level line settles in weight. Reduced motion shows the finished mark.</p>
  <button class="btn" id="riser-btn" type="button">Replay 2 to 3</button></div></div>`)}
${sub('Level line and basis', `<div class="labels on-paper">
  <ul class="labels__levels">${levels.map((l) => `<li>${levelline(l, 22)}</li>`).join('')}</ul>
  <ul class="labels__basis">${(['FACT', 'RESEARCH', 'PRACTICE', 'ASSUMPTION', 'FICTION', 'PROPOSAL'] as Basis[]).map((b) => `<li>${basis(b)}</li>`).join('')}</ul>
</div><p class="sys-note">Basis labels describe rules, fields and mechanisms. Established bases (FACT, RESEARCH, PRACTICE) have a solid frame; ASSUMPTION, FICTION and PROPOSAL a dashed one. Claims carry a level, never a basis.</p>`)}`;
})();

const cardBody = `
<div class="cardstage">
  <div class="cardstage__main">${card(SAMPLE_CARD)}</div>
  <div class="cardstage__rest">
    ${card({ kind: 'Hypothesis', title: 'Specimen explanation', level: 4, body: `<p>Specimen text for an open explanation of group ${v('G')}. Rival: ${v('H-2')}. Support: an outside check ${v('E6')}. Refute: a record ${v('E4')} that contradicts it.</p>`, tomb: { accession: 'H-1', medium: 'Analyst working hypothesis', collection: 'Specimen case, stage 3', window: '2031-03-01 to 2031-03-04', basis: 'FICTION' } })}
    ${card({ kind: 'Verified finding (simulated)', title: 'Specimen of a level 5 card', level: 5, body: `<p>Specimen text. A card at this level carries the sign-off line only because evidence from outside the analysis ${v('E6')} earned it. This page shows a design, not a finding.</p>`, tomb: { accession: 'H-1 / SPECIMEN-0001', medium: 'Outside check (simulated)', collection: 'Outside the analytic chain', window: '2031-03-05', basis: 'FICTION' } })}
    ${card({ kind: 'Hypothesis', title: 'Specimen of a fallen explanation', level: 4, state: 'fallen', was: 4, body: `<p>Specimen text. Struck by a record ${v('E4')} that contradicts it, for group ${v('G')}.</p>`, tomb: { accession: 'H-3', medium: 'Specimen records (E4)', collection: 'Specimen system', window: '2031-03-05', basis: 'ASSUMPTION' } })}
  </div>
</div>
<p class="sys-note">A card is a paper sheet with a cast shadow. The tombstone label is the provenance layer: accession (the record or entry id), medium (source system), collection point, date window, level and basis. Values are fictional and marked so.</p>`;

const catBody = `
<div class="catstage">
  <div class="catstage__rail"><div class="catstage__holder">${catalogue(SAMPLE_CATALOGUE, { id: 'cat-demo', label: 'Catalogue, rail sample' })}</div><p class="sys-note">Rail, from 820 px up. Five registers by level, 5 at the top. Empty registers stay printed. The Level 3 entry has just risen (outlined).</p></div>
  <div class="catstage__mobile">${mobileStill('dark', 'catm', false)}<p class="sys-note">Below 820 px: a bottom bar that always shows the count of expected, not observed. It opens to a modal sheet.</p><button class="btn" id="cat-open" type="button">Open the sheet</button></div>
</div>`;

const narrativeBody = `
<div class="narr">
  <div class="narr__claims">
    ${claim(1, 'S-3', `Record ${v('SPECIMEN-000042')} shows SIM ${v('S-0412')} placed ${v('412')} calls, all associated with cell ${v('SPECIMEN-CELL-07')}.`)}
    ${claim(2, 'S-2', `Specimen: the call count is above the baseline for cells of this type (baseline ${v('B1')}, window ${v('W')}).`)}
    ${claim(3, 'S-1', `Call records and the inbound-traffic shortfall both indicate ${v('X')}. Their independence rests on collection point only.`)}
    ${claim(4, 'H-1', `Hypothesis ${v('H-1')}: a specimen explanation. Alternatives: two specimen rivals. Test: an outside check.`)}
    ${claim(5, 'H-1', `Verified (simulated): specimen wording for level 5, shown only when outside evidence earns it.`)}
  </div>
  <div class="narr__wall">
    ${context('PRACTICE', 'A specimen context block states a mechanism, a definition or a limit of the records.', 'Specimen source note.')}
    ${limit('A cell association is not a position. It is an area where service was possible.')}
  </div>
</div>
<p class="sys-note">Claim blocks are paper slips with their level mark. Context blocks stand on the wall with a basis label and a source note. Limit blocks say what cannot be said, with the lacuna bracket.</p>`;

const mapBody = `
<div class="mapfig">
  <div class="mapfig__national"><div class="mapfig__box plate-box">${nationalPlate({ id: 'natdemo', spot: { x: REGION_CENTRE[0] + 6, y: REGION_CENTRE[1] + 70, r: 215 }, region: true, grat: true })}</div>
    <p class="sys-note">National plate. The real outline (Natural Earth 1:10m, public domain). Graticule every 0.25 degrees. A region tens of kilometres across is lit and hatched. No place names, roads or infrastructure.</p></div>
  <div class="mapfig__legend">
    <h3 class="sys-sub__t">Key</h3>
    <ul class="legend">
      <li><svg viewBox="0 0 64 30"><rect class="region__fill" width="64" height="30"/><rect class="region__hatch" width="64" height="30"/><rect class="region__edge" x="1" y="1" width="62" height="28"/></svg><span><b>Broad region</b>Lit, hatched, solid edge. Level of its entry beside it.</span></li>
      <li><svg viewBox="0 0 64 30"><rect class="sector__fill" width="64" height="30"/><path class="sector__limit" d="M1 29V1H63"/></svg><span><b>Sector</b>Hatched, dashed outer limit. Not a position.</span></li>
      <li><svg viewBox="0 0 64 30"><rect class="obs__base" width="64" height="30"/><rect class="obs__fill" width="64" height="30"/><rect class="obs__edge" x="1" y="1" width="62" height="28"/></svg><span><b>Observation area</b>Union of sectors, cross-hatched, solid blue edge.</span></li>
      <li><svg viewBox="0 0 64 30"><rect class="band__fill" width="64" height="30"/><path class="band__edge" d="M1 0V30M63 0V30"/></svg><span><b>Band</b>Distance from the antenna with a stated error. ASSUMPTION.</span></li>
      <li><svg viewBox="0 0 64 30"><rect class="footprint__fill" width="64" height="30"/><rect class="footprint__edge" x="1" y="1" width="62" height="28"/></svg><span><b>Rival footprint</b>What a competing explanation predicts, dashed.</span></li>
      <li><svg viewBox="0 0 64 30"><rect class="history" x="2" y="2" width="60" height="26" style="fill:none"/></svg><span><b>History outline</b>An earlier state of an area, dotted.</span></li>
      <li><svg viewBox="0 0 64 30"><g class="site"><circle class="site__ring" cx="32" cy="15" r="9"/><path class="site__cross" d="M18 15H46M32 1V29"/><circle class="site__dot" cx="32" cy="15" r="3.4"/></g></svg><span><b>Verified site</b>The only mark that is a point. Solid. Simulated level 5 only.</span></li>
    </ul>
  </div>
</div>
${sub('Case plate: a fictional local grid in kilometres', `<div class="mapfig__case" tabindex="0" role="region" aria-label="Case plate. Scrolls sideways on narrow screens.">${casePlate({ id: 'casedemo' })}</div><p class="sys-note">Two hatched sectors with dashed limits, their union (observation area, outlined in blue), an arc band, two dashed rival footprints and one solid verified-site mark. Sites are never marked: a site is only the apex of its sector. Every plate carries SIMULATED.</p>`)}`;

const spotBody = `
<div class="spotfig">
  <figure><div class="spotfig__box plate-box">${nationalPlate({ id: 'spoton', spot: { x: REGION_CENTRE[0] + 6, y: REGION_CENTRE[1] + 70, r: 215 }, region: true, tags: false })}</div><figcaption class="t-label">Light on the region</figcaption></figure>
  <figure><div class="spotfig__box plate-box">${nationalPlate({ id: 'spotoff', spot: null, region: true, tags: false })}</div><figcaption class="t-label">The same plate, unlit</figcaption></figure>
  <figure class="spotfig__cards"><div class="spotfig__pair">${card({ ...SAMPLE_CARD, kind: 'Lit', lit: 1 })}${card({ ...SAMPLE_CARD, kind: 'Unlit', lit: 0 })}</div><figcaption class="t-label">A card, lit and unlit. Same sheet, lower lightness, text kept.</figcaption></figure>
</div>
<div class="spotfig__live"><div class="spotfig__box spotfig__box--live plate-box" id="spotlive">${nationalPlate({ id: 'spotlive', spot: { x: REGION_CENTRE[0] + 6, y: REGION_CENTRE[1] + 70, r: 215 }, region: true, tags: false })}</div>
  <div><p class="sys-note">The pool is two hard-edged circles, a core and one half-shade step. The veil is black at 30%, clipped to the paper. It is driven by three custom properties, so a tween moves the light and nothing else.</p><button class="btn" id="spot-move" type="button">Move the light</button></div></div>`;

const railBody = `<div class="railfig">${[1, 4, 7].map((n) => `<div class="railfig__row">${stagerail(n as 1, `Case progress sample, stage ${n}`)}</div>`).join('')}</div>
<p class="sys-note">A progress rail, not a menu. State is a shape: done is a filled square, current a square with a ring and a bold name, to do an open square. The fill advances over 1.1 s when a stage changes.</p>`;

const controlsBody = `
<div class="ctl">
  <div class="ctl__surface on-wall">
    <p class="t-label">On the wall</p>
    <div class="actions"><button class="btn btn--primary" type="button">Next stage</button><button class="btn" type="button">Hold</button><button class="btn btn--quiet" type="button">Skip to catalogue</button><button class="btn" type="button" disabled>Sign off</button></div>
    <p class="sys-note">Disabled: dashed frame. The reason is always printed next to it: "Only a level 5 finding can be signed."</p>
    <p class="t-label">Focus, forced for display</p>
    <div class="actions"><button class="btn focus-demo" type="button">Keyboard focus</button></div>
  </div>
  <div class="ctl__surface on-paper">
    <p class="t-label">On paper</p>
    <div class="actions"><button class="btn btn--primary" type="button">Promote</button><button class="btn" type="button">Hold</button><button class="btn" type="button">Reject</button><button class="btn" type="button" disabled>Sign off</button></div>
    <p class="t-label" style="margin-top:var(--s5)">Focus, forced for display</p>
    <div class="actions"><button class="btn focus-demo" type="button">Keyboard focus</button></div>
  </div>
  <fieldset class="chooser ctl__chooser on-paper"><legend class="chooser__legend">Reason for hold (chosen, never typed)</legend>
    ${[['R-01', 'Registration data never arrived'], ['R-02', 'The test call returned nothing'], ['R-03', 'A rival explanation still fits all the evidence']].map(([c, t], i) => `<label class="chooser__opt"><input class="chooser__input" type="radio" name="reason" ${i === 1 ? 'checked' : ''}><span class="chooser__box"><i></i></span><span class="chooser__label">${t}</span><span class="chooser__code">${c}</span></label>`).join('')}
  </fieldset>
</div>`;

const motionBody = `
${sub('Tokens', `<table class="mtable mtable--plain"><thead><tr><th scope="col">Token</th><th scope="col">Value</th><th scope="col">Use</th></tr></thead><tbody>
  <tr><th scope="row"><span class="v">quick</span></th><td class="v">${DURATION.quick} s</td><td>A mark gains a stroke; a card is lit.</td></tr>
  <tr><th scope="row"><span class="v">standard</span></th><td class="v">${DURATION.standard} s</td><td>A level rises or falls; the spotlight crosses to a new exhibit.</td></tr>
  <tr><th scope="row"><span class="v">long</span></th><td class="v">${DURATION.long} s</td><td>A stage changes; an uncertainty area changes shape; the camera changes plate.</td></tr>
  <tr><th scope="row"><span class="v">settle</span></th><td class="v">${EASE.settle}</td><td>Things that arrive. Starts fast, lands softly, never overshoots.</td></tr>
  <tr><th scope="row"><span class="v">travel</span></th><td class="v">${EASE.travel}</td><td>Things that cross the room: the light, the camera, a stage.</td></tr>
  <tr><th scope="row"><span class="v">draw</span></th><td class="v">${EASE.draw}</td><td>Things that grow along a line: the progress rail, hatch, area interpolation.</td></tr></tbody></table>`)}
${sub('The only animated changes', `<ul class="changes">${ANIMATED_CHANGES.map((c) => `<li><span class="v">${c}</span><span>${esc(MOTION_BY_CHANGE[c].names)}</span><span class="v">${MOTION_BY_CHANGE[c].duration} s</span></li>`).join('')}</ul>
<p class="sys-note">Everything else is instant: hover, focus, opening and closing a sheet, text that changes without changing a level, panning by hand. Every animation has a sentence naming what changed; that sentence is also the screen-reader announcement and the reduced-motion caption. With reduced motion the page shows complete stills and all durations are 0.</p>`)}`;

const themesBody = `
<p class="sys-note">The same stage, in both themes. The artefacts do not change; only the wall does.</p>
<div class="stillrow">
  <figure class="still"><figcaption class="t-label">Dark (default)</figcaption>${still('dark', 'stilld')}</figure>
  <figure class="still"><figcaption class="t-label">Light</figcaption>${still('light', 'stilll')}</figure>
</div>
<div class="mobrow">
  <figure><figcaption class="t-label">Mobile, dark, sheet open</figcaption>${mobileStill('dark', 'mobd', true)}</figure>
  <figure><figcaption class="t-label">Mobile, light</figcaption>${mobileStill('light', 'mobl', false)}</figure>
</div>`;

root.innerHTML = `
${defsSprite()}
<header class="sysbar" role="banner">
  <a class="sysbar__brand" href="#top"><span class="brand__name">Solid Snake</span><span class="sysbar__tag">Design system</span></a>
  <nav class="sysbar__nav" aria-label="Sections">${[['colour', 'Colour'], ['type', 'Type'], ['marks', 'Marks'], ['map', 'Map'], ['stills', 'Stills']].map(([h, t]) => `<a href="#${h}">${t}</a>`).join('')}</nav>
  <div class="themeswitch" role="group" aria-label="Theme"><button class="themeswitch__btn" type="button" data-set-theme="dark" aria-pressed="true">Dark</button><button class="themeswitch__btn" type="button" data-set-theme="light" aria-pressed="false">Light</button></div>
</header>
<main id="main">
<section class="sys-hero" id="top">
  <div class="wrap">
    <p class="sys-hero__kicker t-label">Design system &middot; simulation &middot; gate 1</p>
    <h1 class="sys-hero__h t-h1">A claim is set only as far as its evidence allows.</h1>
    <div class="sys-hero__row">
      <p class="t-lede sys-hero__lede">The Proof Sheet, hung as a gallery. Paper artefacts under a spotlight, on a wall that can be dark or light. Five marks, drawn stroke by stroke as evidence is added.</p>
      <ul class="sys-hero__marks on-paper" aria-label="The five levels">${([1, 2, 3, 4, 5] as Level[]).map((l) => `<li>${levelMark(l, { size: 76 })}<span class="t-micro"><b>${l}</b><span class="nm"> ${esc(LEVEL_NAMES[l])}</span></span></li>`).join('')}</ul>
    </div>
    <p class="sys-hero__about t-small">A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners.</p>
  </div>
</section>
${section('01', 'principles', 'Principles', 'What the surface may and may not do.', principles)}
${section('02', 'colour', 'Colour', 'Two walls, one set of artefacts. Contrast is measured, not assumed.', colourBody)}
${section('03', 'type', 'Type', 'Newsreader for what is said, Plex Mono for what is recorded.', typeBody)}
${section('04', 'grid', 'Grid and space', 'Twelve columns, a four-pixel step.', gridBody)}
${section('05', 'marks', 'Evidence marks', 'Numeral, name and shape. Never colour alone.', marksBody)}
${section('06', 'card', 'Exhibit card', 'A paper sheet with a museum label.', cardBody)}
${section('07', 'catalogue', 'Catalogue rail', 'The persistent ledger, in five registers.', catBody)}
${section('08', 'narrative', 'Narrative blocks', 'Claim, context and limit.', narrativeBody)}
${section('09', 'map', 'Map language', 'Areas, hatching and one honest mark.', mapBody)}
${section('10', 'spotlight', 'Spotlight', 'Light falling on an artefact. Lower lightness, never blur.', spotBody)}
${section('11', 'stages', 'Stage rail', 'Seven stages on one persistent map.', railBody)}
${section('12', 'controls', 'Buttons, focus, chooser', 'Reasons are chosen, never typed.', controlsBody)}
${section('13', 'motion', 'Motion', 'Five changes animate. The rest is instant.', motionBody)}
${section('14', 'stills', 'Composed stills', 'Stage 2 as it would look in the app, in both themes.', themesBody, true)}
</main>
<footer class="sysfoot"><div class="wrap"><p class="t-small">A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners.</p><p class="t-micro">Fonts: Newsreader and IBM Plex Mono, SIL OFL 1.1. Outline: Natural Earth 1:10m, public domain. Everything on this page is simulated.</p></div></footer>`;

// ---- behaviour ---------------------------------------------------------------------------------------------------
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  document.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.setTheme === t)));
}
setTheme((document.documentElement.dataset.theme as Theme) === 'light' ? 'light' : 'dark');
document.querySelectorAll<HTMLButtonElement>('[data-set-theme]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.setTheme as Theme)));

// Catalogue sheet: open, close, Escape, focus return.
document.querySelectorAll<HTMLElement>('.catalogue').forEach((cat) => {
  const bar = cat.querySelector<HTMLButtonElement>('.catalogue__bar')!;
  const close = cat.querySelector<HTMLButtonElement>('.catalogue__close')!;
  const set = (open: boolean) => {
    cat.dataset.open = String(open);
    bar.setAttribute('aria-expanded', String(open));
    const sheet = cat.querySelector<HTMLElement>('.catalogue__sheet')!;
    if (open && getComputedStyle(bar).display === 'none' && getComputedStyle(close).display !== 'none') { sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Catalogue'); close.focus(); }
    else { sheet.removeAttribute('role'); sheet.removeAttribute('aria-modal'); sheet.removeAttribute('aria-label'); if (!open) bar.focus({ preventScroll: true }); }
  };
  bar.addEventListener('click', () => set(true));
  cat.querySelectorAll('[data-close]').forEach((e) => e.addEventListener('click', () => set(false)));
  cat.addEventListener('keydown', (e) => { if (e.key === 'Escape' && cat.dataset.open === 'true') set(false); });
});
document.getElementById('cat-open')?.addEventListener('click', () => (document.querySelector('.catstage__mobile .catalogue__bar') as HTMLButtonElement).click());

// A rise, drawn: only the strokes marked .is-new.
function riseDemo() {
  const svg = document.querySelector('#riser svg');
  const line = document.querySelector<HTMLElement>('#riser-line .levelline__name');
  if (!svg) return;
  const fresh = Array.from(svg.querySelectorAll<SVGGeometryElement>('.is-new'));
  if (reduce) return;
  gsap.killTweensOf([...fresh, line]);
  fresh.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`; });
  gsap.to(fresh, { strokeDashoffset: 0, duration: DURATION.standard, ease: EASE.settle, stagger: 0.18, onComplete: () => fresh.forEach((p) => { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }) });
  if (line) gsap.fromTo(line, { '--wt': 300 }, { '--wt': 480, duration: DURATION.standard, ease: EASE.settle });
}
document.getElementById('riser-btn')?.addEventListener('click', riseDemo);

// The light moves: three custom properties, nothing else.
let lit = true;
document.getElementById('spot-move')?.addEventListener('click', () => {
  const plate = document.querySelector<HTMLElement>('#spotlive .plate')!;
  const to = lit ? { '--spot-x': '300px', '--spot-y': '700px', '--spot-r': '170px' } : { '--spot-x': `${REGION_CENTRE[0] + 6}px`, '--spot-y': `${REGION_CENTRE[1] + 70}px`, '--spot-r': '215px' };
  lit = !lit;
  if (reduce) { Object.entries(to).forEach(([k, val]) => plate.style.setProperty(k, val)); return; }
  gsap.to(plate, { ...to, duration: DURATION.standard, ease: EASE.travel });
});

void STAGE_NAMES;
