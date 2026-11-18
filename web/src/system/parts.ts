// Builders for the design-system page. They show how the class contract is meant to be used; the experience engineer can copy them.
import { GRATICULE_LABELS, GRATICULE_PATH, NATIONAL_UNITS_PER_KM, NATIONAL_VIEWBOX, QATAR_PATH, projectLonLat } from '../generated/qatar';
import { LEVEL_NAMES, STAGE_NAMES, type Basis, type Level, type StageId } from '../../../shared/types';
import { lacunaBracket, levelLabel, levelMark, spotMask, type MarkState } from '../ui/marks';

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const v = (s: string) => `<span class="v${s.length > 22 ? ' v--wrap' : ''}">${esc(s)}</span>`;

// ---- levelline, basis ---------------------------------------------------------------------------------------------
export function levelline(level: Level, size = 20): string {
  const l = levelLabel(level);
  return `<span class="levelline${level === 4 ? ' levelline--hyp' : ''}">${levelMark(level, { size })}<span class="levelline__num">${l.numeral}</span><span class="levelline__name">${esc(l.name)}</span></span>`;
}
export const basis = (b: Basis) => `<span class="basis" data-basis="${b}">${b}</span>`;

// ---- exhibit card -------------------------------------------------------------------------------------------------
export interface CardOpts {
  kind: string;
  title: string;
  body: string;
  level: Level;
  state?: MarkState;
  was?: Level;
  tomb: { accession: string; medium: string; collection: string; window: string; basis: Basis };
  className?: string;
  lit?: number;
}
export function card(o: CardOpts): string {
  const st = o.state ?? 'current';
  const mod = st !== 'current' ? `card--${st}` : o.level >= 4 ? `card--l${o.level}` : '';
  const row = (k: string, val: string, mono = false) => `<div class="tombstone__row"><dt class="tombstone__k">${k}</dt><dd class="tombstone__v${mono ? ' tombstone__v--mono' : ''}">${val}</dd></div>`;
  return `<article class="card ${mod} ${o.className ?? ''}"${o.lit !== undefined ? ` style="--lit:${o.lit}"` : ''}>
    <header class="card__head"><span class="card__kind">${esc(o.kind)}</span><span class="card__mark">${levelMark(o.level, { size: 36, state: st })}</span></header>
    <h3 class="card__title">${esc(o.title)}</h3>
    <div class="card__body">${o.body}</div>
    ${st === 'fallen' && o.was ? `<p class="card__was">was <span class="v">${o.was}</span></p>` : ''}
    ${o.level === 5 && st === 'current' ? `<div class="card__signoff"><span class="card__signoff-line"></span><span class="card__signoff-text">VERIFIED (SIMULATED)</span></div>` : ''}
    <dl class="tombstone" aria-label="Provenance">
      ${row('Accession', esc(o.tomb.accession), true)}
      ${row('Medium', esc(o.tomb.medium))}
      ${row('Collection point', esc(o.tomb.collection))}
      ${row('Window', esc(o.tomb.window), true)}
      ${row('Level', levelline(o.level, 18))}
      ${row('Basis', basis(o.tomb.basis))}
    </dl>
  </article>`;
}

export const SAMPLE_CARD: CardOpts = {
  kind: 'Indicator',
  title: 'Voice activity of a specimen group',
  level: 2,
  body: `<p>Record ${v('SPECIMEN-000042')} shows ${v('SPECIMEN-SUB-0412')} originating ${v('412')} sessions on cell ${v('SPECIMEN-CELL-07')} in the window. That is above the baseline ${v('B1')} for cells of this type.</p><p>A score here is a sort key. It is not a probability.</p>`,
  tomb: { accession: 'S-1 / SPECIMEN-000042', medium: 'S-CSCF charging records (E1)', collection: 'Serving node, fictional core', window: '2031-03-01 to 2031-03-04', basis: 'FICTION' },
};

// ---- narrative ----------------------------------------------------------------------------------------------------
export function claim(level: Level, id: string, text: string): string {
  const l = levelLabel(level);
  return `<div class="claim claim--l${level}">
    <span class="claim__mark">${levelMark(level, { size: 32 })}</span>
    <p class="claim__meta"><span class="v">${esc(id)}</span> &middot; Level ${l.numeral} &middot; ${esc(l.name)}</p>
    <p class="claim__text">${text}</p>
  </div>`;
}
export const context = (b: Basis, text: string, source: string) =>
  `<div class="context"><p class="context__basis">${basis(b)}</p><p class="context__text">${text}</p><p class="context__source">${esc(source)}</p></div>`;
export const limit = (text: string, label = 'Cannot be said here', surface: 'wall' | 'wall-light' = 'wall') =>
  `<div class="limit"><span class="limit__mark">${lacunaBracket({ width: 44, height: 22, surface, label })}</span><p class="limit__label">${esc(label)}</p><p class="limit__text">${text}</p></div>`;

// ---- catalogue ----------------------------------------------------------------------------------------------------
type EntryState = 'current' | 'fallen' | 'struck' | 'awaiting';
export interface EntryOpts { id: string; title: string; level?: Level; state?: EntryState; meta?: string; hyp?: boolean; isNew?: boolean }
export function entry(e: EntryOpts): string {
  const st = e.state ?? 'current';
  const showMark = st === 'fallen' || st === 'awaiting';
  const mark = st === 'fallen' ? levelMark(4, { size: 18, state: 'fallen' }) : st === 'awaiting' ? levelMark(e.level ?? 1, { size: 18, state: 'awaiting' }) : '';
  const cls = ['entry', st !== 'current' ? `entry--${st}` : '', e.hyp ? 'entry--hyp' : '', e.isNew ? 'is-new' : ''].filter(Boolean).join(' ');
  return `<li class="${cls}"><a class="entry__link" href="#${esc(e.id)}"><span class="entry__id">${esc(e.id)}</span><span class="entry__title">${esc(e.title)}</span>${showMark ? `<span class="entry__mark">${mark}</span>` : ''}${e.meta ? `<span class="entry__meta">${esc(e.meta)}</span>` : ''}</a></li>`;
}
export function register(level: Level, entries: EntryOpts[], idp = 'reg'): string {
  const l = levelLabel(level);
  return `<div role="group" class="register" aria-labelledby="${idp}-${level}">
    <h3 class="register__head" id="${idp}-${level}"><span class="register__mark">${levelMark(level, { size: 20 })}</span><span class="register__num">${l.numeral}</span><span class="register__name">${esc(l.name)}</span><span class="register__count">${entries.length}</span></h3>
    ${entries.length ? `<ol class="register__list">${entries.map(entry).join('')}</ol>` : `<p class="register__none">None yet</p>`}
  </div>`;
}
export interface CatalogueData { byLevel: Record<Level, EntryOpts[]>; fallen: EntryOpts[]; lacunae: EntryOpts[] }
export const SAMPLE_CATALOGUE: CatalogueData = {
  byLevel: {
    5: [],
    4: [
      { id: 'H-1', title: 'Specimen explanation', hyp: true },
      { id: 'H-2', title: 'Specimen rival explanation', hyp: true },
    ],
    3: [{ id: 'S-1', title: 'Voice activity of group G', meta: 'Rose from 2 by I-2', isNew: true }],
    2: [{ id: 'S-2', title: 'Where G was observed' }],
    1: [{ id: 'S-3', title: 'Devices used by G' }, { id: 'S-5', title: 'Registration of G', state: 'awaiting', level: 1, meta: 'Awaiting E4' }],
  },
  fallen: [{ id: 'H-3', title: 'Specimen fallen explanation', state: 'fallen', meta: 'Was 4' }],
  lacunae: [
    { id: 'X-1', title: 'Inbound sessions on route R (E2)' },
    { id: 'X-2', title: 'Registration data for G (E4)' },
    { id: 'X-3', title: 'Test call result (E6)' },
  ],
};
export function catalogue(d: CatalogueData, o: { open?: boolean; id?: string; label?: string } = {}): string {
  const id = o.id ?? 'cat';
  const levels: Level[] = [5, 4, 3, 2, 1];
  const total = levels.reduce((n, l) => n + d.byLevel[l].length, 0) + d.fallen.length;
  const lac = d.lacunae.length;
  const lacMark = lacunaBracket({ width: 30, height: 18 });
  return `<aside class="catalogue" data-open="${o.open ? 'true' : 'false'}" aria-label="${esc(o.label ?? 'Catalogue')}">
    <div class="catalogue__scrim" data-close></div>
    <button class="catalogue__bar" type="button" aria-expanded="${o.open ? 'true' : 'false'}" aria-controls="${id}-sheet">
      <span class="catalogue__bar-main"><span class="catalogue__bar-title">Catalogue</span><span class="catalogue__bar-count">${total} entries</span></span>
      <span class="catalogue__bar-lacuna">${lacunaBracket({ width: 30, height: 20 })}<span><b>${lac}</b> expected, not observed</span></span>
    </button>
    <div class="catalogue__sheet" id="${id}-sheet">
      <header class="catalogue__head">
        <h2 class="catalogue__title">Catalogue</h2>
        <button class="catalogue__close" type="button" data-close>Close</button>
        <p class="catalogue__total">${total} entries &middot; specimen case</p>
        <div class="tally" role="group" aria-label="Entries per level">
          ${levels.slice().reverse().map((l) => `<div class="tally__cell"><span class="tally__n">${d.byLevel[l].length}</span><span class="tally__k">L${l}</span></div>`).join('')}
          <div class="tally__cell"><span class="tally__n">${lac}</span><span class="tally__k">Exp.</span></div>
        </div>
        <p class="catalogue__lacunae">${lacMark}<span><b>${lac}</b> expected, not observed</span></p>
      </header>
      <div class="catalogue__body">
        ${levels.map((l) => register(l, d.byLevel[l], `${id}-reg`)).join('')}
        <div role="group" class="register" aria-labelledby="${id}-fallen">
          <h3 class="register__head" id="${id}-fallen"><span class="register__mark">${levelMark(4, { size: 20, state: 'fallen' })}</span><span class="register__num">&times;</span><span class="register__name">Fallen</span><span class="register__count">${d.fallen.length}</span></h3>
          <ol class="register__list">${d.fallen.map(entry).join('')}</ol></div>
        <div role="group" class="register register--lacuna" aria-labelledby="${id}-lac">
          <h3 class="register__head" id="${id}-lac"><span class="register__mark">${lacunaBracket({ width: 30, height: 18 })}</span><span class="register__name">Expected, not observed</span><span class="register__count">${lac}</span></h3>
          <ol class="register__list">${d.lacunae.map((e) => entry({ ...e }).replace('class="entry"', 'class="entry entry--lacuna"')).join('')}</ol></div>
      </div>
    </div>
  </aside>`;
}

// ---- stage rail ---------------------------------------------------------------------------------------------------
export function stagerail(current: StageId, label = "Case progress"): string {
  const items = ([1, 2, 3, 4, 5, 6, 7] as StageId[])
    .map((n) => {
      const st = n < current ? 'done' : n === current ? 'current' : 'todo';
      const sr = st === 'done' ? ' (completed)' : st === 'current' ? ' (current stage)' : ' (not reached)';
      return `<li class="stagerail__item" data-state="${st}"${st === 'current' ? ' aria-current="step"' : ''}><span class="stagerail__node"></span><span class="stagerail__num">${n}</span><span class="stagerail__name">${STAGE_NAMES[n]}<span class="sr-only">${sr}</span></span></li>`;
    })
    .join('');
  return `<nav class="stagerail" aria-label="${esc(label)}" style="--progress:${(current - 1) / 6}"><p class="stagerail__summary">Stage <b>${current}</b> of 7: ${STAGE_NAMES[current]}</p><div class="stagerail__track"></div><div class="stagerail__fill"></div><ol class="stagerail__list">${items}</ol></nav>`;
}

// ---- national plate -----------------------------------------------------------------------------------------------
/** A smooth closed blob through the midpoints of a polygon, in plate units. */
function blob(pts: [number, number][]): string {
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
  const n = pts.length;
  const m0 = mid(pts[n - 1]!, pts[0]!);
  let d = `M${m0[0].toFixed(1)} ${m0[1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % n]!);
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return d + 'Z';
}
const REGION_LONLAT: [number, number][] = [
  [51.2, 25.52], [51.27, 25.63], [51.38, 25.66], [51.47, 25.6], [51.5, 25.5], [51.45, 25.39], [51.35, 25.33], [51.25, 25.37], [51.19, 25.43],
];
export const REGION_PATH = blob(REGION_LONLAT.map(projectLonLat));
const regionCentre = (() => {
  const p = REGION_LONLAT.map(projectLonLat);
  return [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length] as [number, number];
})();
export const REGION_CENTRE = regionCentre;

export interface NationalOpts {
  id: string;
  /** Pool of light in plate units, or null for a plate in shade. */
  spot: { x: number; y: number; r: number } | null;
  region?: boolean;
  /** Region and scale labels. */
  tags?: boolean;
  /** Graticule edge labels (longitude and latitude). */
  grat?: boolean;
  className?: string;
}
export function nationalPlate(o: NationalOpts): string {
  const w = NATIONAL_VIEWBOX.w;
  const h = NATIONAL_VIEWBOX.h;
  const s = o.spot;
  const spot = s ? `--spot-x:${s.x}px;--spot-y:${s.y}px;--spot-r:${s.r}px` : `--spot-x:${regionCentre[0]}px;--spot-y:${regionCentre[1]}px;--spot-r:0px`;
  const px = (x: number) => (x / w) * 100;
  const py = (y: number) => (y / h) * 100;
  const km = NATIONAL_UNITS_PER_KM;
  const sbX = 560;
  const sbY = 868;
  const scale = [0, 1, 2, 3].map((i) => `<rect x="${sbX + i * 5 * km}" y="${sbY}" width="${5 * km}" height="6"/>`).join('');
  const labels = GRATICULE_LABELS.map((g) => `<span class="plate__tag plate__tag--wall ${g.axis === 'lon' ? 'plate__tag--mid' : ''}" style="--x:${px(g.x + (g.axis === 'lat' ? 20 : 0))};--y:${py(g.y - 7)}" aria-hidden="true">${g.deg.toFixed(1)}&deg;${g.axis === 'lon' ? 'E' : 'N'}</span>`).join('');
  return `<figure class="plate plate--national ${o.className ?? ''}" style="--ar:0.8;${spot}" aria-label="Plate: the Qatar outline, simulated. ${o.region ? 'A broad region is lit and hatched.' : 'No region is lit.'}">
    <svg class="plate__svg" viewBox="${NATIONAL_VIEWBOX.attr}" role="presentation" focusable="false">
      <defs>
        <clipPath id="land-${o.id}"><path d="${QATAR_PATH}"/></clipPath>
        ${spotMask(`spot-${o.id}`, w, h)}
      </defs>
      <path class="plate__graticule--wall" d="${GRATICULE_PATH}"/>
      <path class="plate__shadow" d="${QATAR_PATH}" transform="translate(5 8)"/>
      <path class="plate__land" d="${QATAR_PATH}"/>
      <g clip-path="url(#land-${o.id})"><path class="plate__graticule" d="${GRATICULE_PATH}"/></g>
      ${o.region ? `<g class="region"><path class="region__fill" d="${REGION_PATH}"/><path class="region__hatch" d="${REGION_PATH}"/><path class="region__edge" d="${REGION_PATH}"/></g>` : ''}
      <g clip-path="url(#land-${o.id})"><rect class="plate__veil" width="${w}" height="${h}" mask="url(#spot-${o.id})"/></g>
      <g class="plate__scalebar">${scale}</g>
    </svg>
    ${o.grat ? labels : ''}
    ${o.region && o.tags !== false ? `<span class="plate__tag plate__tag--mid" style="--x:${px(regionCentre[0])};--y:${py(regionCentre[1] + 72)}">Region R<b>Tens of km &middot; S-2</b></span>` : ''}
    <span class="plate__tag plate__tag--wall plate__tag--mid" style="--x:${px(sbX + 10 * km)};--y:${py(sbY + 14)}">20 km</span>
    <span class="plate__north" style="--x:${px(704)};--y:${py(96)}" aria-hidden="true"><svg viewBox="0 0 22 34"><path d="M11 3L4 31L11 25L18 31Z"/></svg>N</span>
    <span class="simulated" style="--x:5;--y:${o.grat ? 93 : 84}">Simulated</span>
  </figure>`;
}

// ---- case plate (fictional local grid, km) ------------------------------------------------------------------------
const KM = 80;
const rad = (deg: number) => (deg * Math.PI) / 180;
const pol = (ax: number, ay: number, az: number, r: number) => [ax + r * Math.sin(rad(az)), ay - r * Math.cos(rad(az))] as const;
const f = (n: number) => n.toFixed(1);
function wedge(ax: number, ay: number, az: number, bw: number, r: number): string {
  const a = pol(ax, ay, az - bw / 2, r);
  const b = pol(ax, ay, az + bw / 2, r);
  return `M${ax} ${ay}L${f(a[0])} ${f(a[1])}A${r} ${r} 0 0 1 ${f(b[0])} ${f(b[1])}Z`;
}
function limitArc(ax: number, ay: number, az: number, bw: number, r: number): string {
  const a = pol(ax, ay, az - bw / 2, r);
  const b = pol(ax, ay, az + bw / 2, r);
  return `M${f(a[0])} ${f(a[1])}A${r} ${r} 0 0 1 ${f(b[0])} ${f(b[1])}`;
}
function annulus(ax: number, ay: number, az: number, bw: number, r0: number, r1: number): string {
  const a0 = pol(ax, ay, az - bw / 2, r0), a1 = pol(ax, ay, az - bw / 2, r1);
  const b0 = pol(ax, ay, az + bw / 2, r0), b1 = pol(ax, ay, az + bw / 2, r1);
  return `M${f(a0[0])} ${f(a0[1])}L${f(a1[0])} ${f(a1[1])}A${r1} ${r1} 0 0 1 ${f(b1[0])} ${f(b1[1])}L${f(b0[0])} ${f(b0[1])}A${r0} ${r0} 0 0 0 ${f(a0[0])} ${f(a0[1])}Z`;
}

export const CASE_W = 1200;
export const CASE_H = 880;
export interface CaseOpts { id: string; spot?: { x: number; y: number; r: number } | null }
export function casePlate(o: CaseOpts): string {
  const A1 = { x: 360, y: 560, az: 52, bw: 70, r: 5.2 * KM };
  const A2 = { x: 600, y: 700, az: 330, bw: 70, r: 4.6 * KM };
  const px = (x: number) => (x / CASE_W) * 100;
  const py = (y: number) => (y / CASE_H) * 100;
  const site = pol(A1.x, A1.y, 40, 2.95 * KM);
  const grid = (() => {
    let minor = '', major = '';
    for (let i = 1; i < 15; i++) { const x = 60 + i * KM; (i % 5 === 0 ? (major += `M${x} 60V${CASE_H - 60}`) : (minor += `M${x} 60V${CASE_H - 60}`)); }
    for (let j = 1; j < 10; j++) { const y = 60 + j * KM; (j % 5 === 0 ? (major += `M60 ${y}H${CASE_W - 60}`) : (minor += `M60 ${y}H${CASE_W - 60}`)); }
    return { minor, major };
  })();
  const fp1 = blob([[700, 300], [780, 250], [880, 270], [930, 340], [890, 410], [800, 430], [720, 390]]);
  const fp2 = blob([[790, 590], [900, 560], [1010, 575], [1060, 630], [1000, 690], [880, 700], [800, 665]]);
  const s = o.spot === undefined ? { x: 600, y: 440, r: 1500 } : o.spot;
  const spot = s ? `--spot-x:${s.x}px;--spot-y:${s.y}px;--spot-r:${s.r}px` : `--spot-x:520px;--spot-y:430px;--spot-r:0px`;
  const sb = [0, 1, 2, 3].map((i) => `<rect x="${760 + i * KM}" y="${CASE_H - 86}" width="${KM}" height="7"/>`).join('');
  return `<div class="plate-box plate-box--wide"><figure class="plate plate--case" style="--ar:${CASE_W / CASE_H};${spot}" aria-label="Case plate, fictional local grid in kilometres, simulated.">
    <svg class="plate__svg" viewBox="0 0 ${CASE_W} ${CASE_H}" role="presentation" focusable="false">
      <defs>${spotMask(`spot-${o.id}`, CASE_W, CASE_H)}<clipPath id="sheet-${o.id}"><rect width="${CASE_W}" height="${CASE_H}"/></clipPath></defs>
      <rect class="plate__shadow" x="6" y="10" width="${CASE_W}" height="${CASE_H}"/>
      <rect class="plate__sheet" width="${CASE_W}" height="${CASE_H}"/>
      <path class="plate__grid--minor" d="${grid.minor}"/>
      <path class="plate__grid--major" d="${grid.major}"/>
      <g class="obs"><path class="obs__edge" d="${wedge(A1.x, A1.y, A1.az, A1.bw, A1.r)}" style="stroke-width:5"/><path class="obs__edge" d="${wedge(A2.x, A2.y, A2.az, A2.bw, A2.r)}" style="stroke-width:5"/>
        <path class="obs__base" d="${wedge(A1.x, A1.y, A1.az, A1.bw, A1.r)}"/><path class="obs__base" d="${wedge(A2.x, A2.y, A2.az, A2.bw, A2.r)}"/></g>
      <g class="sector"><path class="sector__fill" d="${wedge(A1.x, A1.y, A1.az, A1.bw, A1.r)}"/><path class="sector__edge" d="M${A1.x} ${A1.y}L${f(pol(A1.x, A1.y, A1.az - 35, A1.r)[0])} ${f(pol(A1.x, A1.y, A1.az - 35, A1.r)[1])}M${A1.x} ${A1.y}L${f(pol(A1.x, A1.y, A1.az + 35, A1.r)[0])} ${f(pol(A1.x, A1.y, A1.az + 35, A1.r)[1])}"/><path class="sector__limit" d="${limitArc(A1.x, A1.y, A1.az, A1.bw, A1.r)}"/></g>
      <g class="sector"><path class="sector__fill" d="${wedge(A2.x, A2.y, A2.az, A2.bw, A2.r)}"/><path class="sector__edge" d="M${A2.x} ${A2.y}L${f(pol(A2.x, A2.y, A2.az - 35, A2.r)[0])} ${f(pol(A2.x, A2.y, A2.az - 35, A2.r)[1])}M${A2.x} ${A2.y}L${f(pol(A2.x, A2.y, A2.az + 35, A2.r)[0])} ${f(pol(A2.x, A2.y, A2.az + 35, A2.r)[1])}"/><path class="sector__limit" d="${limitArc(A2.x, A2.y, A2.az, A2.bw, A2.r)}"/></g>
      <g class="band"><path class="band__fill" d="${annulus(A1.x, A1.y, A1.az, A1.bw, 2.55 * KM, 3.35 * KM)}"/><path class="band__edge" d="${annulus(A1.x, A1.y, A1.az, A1.bw, 2.55 * KM, 3.35 * KM)}"/></g>
      <g class="footprint"><path class="footprint__fill" d="${fp1}"/><path class="footprint__edge" d="${fp1}"/></g>
      <g class="footprint"><path class="footprint__fill" d="${fp2}"/><path class="footprint__edge" d="${fp2}"/></g>
      <g class="site"><circle class="site__ring" cx="${f(site[0])}" cy="${f(site[1])}" r="13"/><path class="site__cross" d="M${f(site[0] - 22)} ${f(site[1])}H${f(site[0] + 22)}M${f(site[0])} ${f(site[1] - 22)}V${f(site[1] + 22)}"/><circle class="site__dot" cx="${f(site[0])}" cy="${f(site[1])}" r="4.5"/></g>
      <g clip-path="url(#sheet-${o.id})"><rect class="plate__veil" width="${CASE_W}" height="${CASE_H}" mask="url(#spot-${o.id})"/></g>
      <g class="plate__scalebar">${sb}</g>
    </svg>
    <span class="plate__tag" style="--x:${px(A1.x + 14)};--y:${py(A1.y + 14)}">Sector S-1<b>Fictional site at the apex</b></span>
    <span class="plate__tag plate__tag--end" style="--x:${px(A2.x - 14)};--y:${py(A2.y + 14)}">Sector S-2<b>Fictional site at the apex</b></span>
    <span class="plate__tag" style="--x:${px(430)};--y:${py(180)}">Observation area<b>Union of S-1 and S-2</b></span>
    <span class="plate__tag plate__tag--wrap" style="--x:${px(190)};--y:${py(330)}">Band<b>Distance from the antenna, N steps plus stated error. ASSUMPTION</b></span>
    <span class="plate__tag" style="--x:${px(site[0] + 34)};--y:${py(site[1] - 8)}">Verified (simulated)<b>Survey mark</b></span>
    <span class="plate__tag" style="--x:${px(740)};--y:${py(200)}">H-2 footprint<b>Rival, dashed</b></span>
    <span class="plate__tag" style="--x:${px(790)};--y:${py(730)}">H-3 footprint<b>Rival, dashed</b></span>
    <span class="plate__tag plate__tag--fit" style="--x:${px(60)};--y:${py(CASE_H - 52)}">Fictional grid. Positions do not correspond to real places.</span>
    <span class="plate__tag" style="--x:${px(760)};--y:${py(CASE_H - 70)}">0</span><span class="plate__tag plate__tag--end" style="--x:${px(760 + 4 * KM)};--y:${py(CASE_H - 70)}">4 km</span>
    <span class="simulated" style="--x:${px(60)};--y:${py(86)}">Simulated</span>
  </figure></div>`;
}
