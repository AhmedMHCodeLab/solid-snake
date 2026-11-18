// Analytical graphics, hand-built. The plot is an SVG stretched to its box (strokes do not scale); every word and number
// is HTML placed over it, so type stays crisp at any width. Every chart names its axes, unit, window, source and the
// level of the entry it is bound to. A position on a distribution is an ordering, never a probability.
import type { CaseSummary, Chart, Indicator, Level } from '../../../shared/types';
import { lacunaBracket } from '../ui/marks';
import { cap, esc, hoursIn, levelline, num, ref, sourceName, windowText } from './util';

type C = Pick<CaseSummary, 'sources' | 'window' | 'strip' | 'indicators' | 'entities'>;

/** Round axis maximum and tick step. */
export function niceScale(max: number, ticks = 4): { max: number; step: number } {
  if (!(max > 0)) return { max: 1, step: 0.25 };
  const raw = max / ticks;
  const p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? 10 * p;
  return { max: Math.ceil(max / step) * step, step };
}
const pc = (n: number) => +n.toFixed(2);

interface Frame { kind: string; id: string; title: string; entryId: string; level: Level | null; source: string; unit: string; ruleId?: string; basis?: string }
function head(c: C, f: Frame): string {
  return `<figcaption class="chart__cap">
    <p class="chart__kicker">${esc(f.kind)}</p>
    <h4 class="chart__title" id="${esc(f.id)}-t">${esc(f.title)}</h4>
    <p class="chart__bind">${f.entryId ? `<span class="chart__bind-item">Bound to ${ref(f.entryId)} ${f.level ? levelline(f.level, 16) : '<span class="chart__nolevel">no level yet</span>'}</span>` : '<span class="chart__bind-item">Operational view, not evidence: carries no level</span>'}<span class="chart__bind-item">Source: ${esc(sourceName(c, f.source))} ${ref(f.source)}</span><span class="chart__bind-item">Unit: ${esc(f.unit)}</span></p>
  </figcaption>`;
}
const foot = (c: C, note: string, extra = '') =>
  `<p class="chart__note">${esc(note)}${extra} <span class="chart__win">Window ${esc(windowText(c.window))}, exercise data.</span></p>`;
const yTicks = (max: number, step: number, fmt = (n: number) => num(n)) => {
  let s = '';
  for (let t = 0; t <= max + 1e-9; t += step) s += `<span class="chart__tick chart__tick--y" style="--y:${pc(100 - (t / max) * 100)}">${esc(fmt(+t.toFixed(4)))}</span>`;
  return s;
};
const yGrid = (max: number, step: number) => {
  let d = '';
  for (let t = step; t <= max + 1e-9; t += step) d += `M0 ${pc(1000 - (t / max) * 1000)}H1000`;
  return `<path class="chart__grid" d="${d}"/><path class="chart__axis" d="M0 0V1000H1000"/>`;
};
const plot = (svg: string, labels: string, h = 'var(--chart-h)') =>
  `<div class="chart__plot" style="--h:${h}"><svg class="chart__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">${svg}</svg>${labels}</div>`;
const axes = (yLabel: string, xLabel: string, inner: string) =>
  `<div class="chart__body"><p class="chart__ylab">${esc(yLabel)}</p>${inner}<p class="chart__xlab">${esc(xLabel)}</p></div>`;
const key = (items: [string, string][]) => `<ul class="chart__key">${items.map(([cls, t]) => `<li><span class="chart__sw chart__sw--${cls}" aria-hidden="true"></span>${esc(t)}</li>`).join('')}</ul>`;

// ---- (a) time series against a baseline band ----------------------------------------------------------------------
export function timeseries(c: C, ch: Chart, level: Level | null): string {
  const subj = ch.series.find((s) => s.role === 'subject') ?? ch.series[0];
  if (!subj) return '';
  const ref2 = ch.series.find((s) => s !== subj && (s.role === 'population' || s.role === 'baseline' || s.role === 'expected'));
  const n = subj.values.length;
  const band = ch.band;
  const max = niceScale(Math.max(...subj.values, ...(band?.high ?? [0]), ...(ref2?.values ?? [0])));
  const X = (i: number) => (i / n) * 1000, Y = (v: number) => 1000 - (v / max.max) * 1000;
  const stepLine = (vals: number[]) => { let d = `M0 ${pc(Y(vals[0] ?? 0))}`; vals.forEach((v, i) => (d += `H${pc(X(i))}V${pc(Y(v))}H${pc(X(i + 1))}`)); return d; };
  const line = stepLine(subj.values);
  const refLine = ref2 ? `<path class="chart__line chart__line--ref" d="${stepLine(ref2.values)}"/>` : '';
  let bandD = '';
  if (band) {
    bandD = `M0 ${pc(Y(band.high[0] ?? 0))}`;
    band.high.forEach((v, i) => (bandD += `H${pc(X(i))}V${pc(Y(v))}H${pc(X(i + 1))}`));
    for (let i = band.low.length - 1; i >= 0; i--) bandD += `V${pc(Y(band.low[i]!))}H${pc(X(i))}`;
    bandD += 'Z';
  }
  const bucket = ch.bucketMinutes ?? 60;
  const perDay = Math.round(1440 / bucket);
  let xt = '';
  for (let i = 0; i <= n; i += perDay) xt += `<span class="chart__tick chart__tick--x" style="--x:${pc((i / n) * 100)}">${i === 0 ? 'Start' : `Day ${i / perDay}`}</span>`;
  const peak = Math.max(...subj.values);
  const desc = `${subj.label}: highest ${num(peak)} ${ch.unit} in one ${bucket}-minute period.${band ? ` ${band.label}: ${num(Math.min(...band.low))} to ${num(Math.max(...band.high))}.` : ''}`;
  return `<figure class="chart chart--timeseries" data-chart="${esc(ch.id)}" aria-labelledby="${esc(ch.id)}-t">
    ${head(c, { kind: 'Time series', id: ch.id, title: ch.title, entryId: ch.entryId, level, source: ch.source, unit: ch.unit })}
    ${axes(ch.yLabel, ch.xLabel, plot(`${yGrid(max.max, max.step)}${bandD ? `<path class="chart__band" d="${bandD}"/>` : ''}${refLine}<path class="chart__line" d="${line}"/>`, yTicks(max.max, max.step) + xt))}
    ${key([['subject', subj.label], ...(ref2 ? ([['ref', ref2.label]] as [string, string][]) : []), ...(band ? ([['band', band.label]] as [string, string][]) : [])])}
    <p class="sr-only">${esc(desc)}</p>
    ${foot(c, ch.note)}
  </figure>`;
}

// ---- (b) distribution with the subject's position -----------------------------------------------------------------
const lowOf = (label: string) => { const m = /-?\d+(\.\d+)?/.exec(label); return m ? Number(m[0]) : NaN; };
export function distribution(c: C, ch: Chart, level: Level | null): string {
  const cats = ch.categories ?? [];
  const pop = ch.series.find((s) => s.role === 'population') ?? ch.series[0];
  const subj = ch.series.find((s) => s.role === 'subject');
  if (!pop || !cats.length) return '';
  const max = niceScale(Math.max(...pop.values, ...(subj?.values ?? [0])));
  const n = cats.length, w = 1000 / n;
  const bars = pop.values.map((v, i) => `<rect class="chart__bar" x="${pc(i * w + w * 0.08)}" y="${pc(1000 - (v / max.max) * 1000)}" width="${pc(w * 0.84)}" height="${pc((v / max.max) * 1000)}"/>`).join('');
  const sbars = subj ? subj.values.map((v, i) => (v ? `<rect class="chart__bar chart__bar--subject" x="${pc(i * w + w * 0.08)}" y="${pc(1000 - (v / max.max) * 1000)}" width="${pc(w * 0.84)}" height="${pc((v / max.max) * 1000)}"/>` : '')).join('') : '';
  let mk = '';
  if (ch.marker) {
    const lows = cats.map(lowOf);
    let x = NaN;
    if (lows.every((l) => !Number.isNaN(l))) {
      const step = n > 1 ? lows[1]! - lows[0]! : 1;
      x = ((ch.marker.value - lows[0]!) / (step * n)) * 1000;
    }
    if (!Number.isNaN(x)) {
      x = Math.min(1000, Math.max(0, x));
      mk = `<path class="chart__marker" d="M${pc(x)} 0V1000"/>`;
      mk += `<span class="chart__mlabel${x > 600 ? ' chart__mlabel--end' : ''}" style="--x:${pc(x / 10)}">${esc(ch.marker.label)} <span class="v">${num(ch.marker.value)}</span><b>An ordering against the population, not a probability</b></span>`;
    }
  }
  const every = Math.ceil(n / 8);
  const xt = cats.map((l, i) => (i % every === 0 ? `<span class="chart__tick chart__tick--x chart__tick--mid" style="--x:${pc(((i + 0.5) / n) * 100)}">${esc(l)}</span>` : '')).join('');
  const svgMk = mk.startsWith('<path') ? mk.slice(0, mk.indexOf('/>') + 2) : '';
  const htmlMk = mk.slice(svgMk.length);
  return `<figure class="chart chart--distribution" data-chart="${esc(ch.id)}" aria-labelledby="${esc(ch.id)}-t">
    ${head(c, { kind: 'Distribution', id: ch.id, title: ch.title, entryId: ch.entryId, level, source: ch.source, unit: ch.unit })}
    ${axes(ch.yLabel, ch.xLabel, plot(`${yGrid(max.max, max.step)}${bars}${sbars}${svgMk}`, yTicks(max.max, max.step) + xt + htmlMk))}
    ${key([['population', pop.label], ...(subj ? ([['subject', subj.label]] as [string, string][]) : []), ...(ch.marker ? ([['marker', ch.marker.label]] as [string, string][]) : [])])}
    ${foot(c, ch.note)}
  </figure>`;
}

// ---- (c) volume against each route's own history; the shortfall is the bracketed gap ------------------------------
export interface CompareRow { label: string; expected: number; observed: number }
export function compareRows(rows: CompareRow[], unit: string, idp: string): string {
  const max = niceScale(Math.max(...rows.map((r) => Math.max(r.expected, r.observed))));
  return `<ol class="lanes" aria-label="Observed against expected, ${esc(unit)}">${rows
    .map((r, i) => {
      const e = (r.expected / max.max) * 100, o = (r.observed / max.max) * 100;
      const gap = r.expected - r.observed;
      const short = gap > r.expected * 0.1;
      return `<li class="lane${short ? ' lane--short' : ''}" data-lane="${i}">
        <p class="lane__label">${esc(r.label)}</p>
        <div class="lane__track">
          <span class="lane__expected" style="--w:${pc(e)}"></span>
          <span class="lane__observed" style="--w:${pc(o)}"></span>
          ${short ? `<span class="lane__gap" style="--l:${pc(o)};--w:${pc(e - o)}">${lacunaBracket({ width: 60, height: 22, label: `${num(+gap.toFixed(3))} ${unit} expected, not observed`, className: 'lane__bracket' })}</span>` : ''}
        </div>
        <p class="lane__nums"><span class="v">${num(r.observed)}</span> observed of <span class="v">${num(r.expected)}</span> expected${short ? `<b> &middot; <span class="v">${num(+gap.toFixed(3))}</span> expected, not observed</b>` : ' &middot; within its own history'}</p>
      </li>`;
    })
    .join('')}</ol><div class="lanes__scale" aria-hidden="true">${(() => { let s = ''; for (let t = 0; t <= max.max + 1e-9; t += max.step) s += `<span style="--x:${pc((t / max.max) * 100)}">${num(+t.toFixed(3))}</span>`; return s; })()}</div><span class="sr-only" id="${esc(idp)}-u">${esc(unit)}</span>`;
}
export function comparison(c: C, ch: Chart, level: Level | null): string {
  const cats = ch.categories ?? [];
  const exp = ch.series.find((s) => s.role === 'expected' || s.role === 'baseline');
  const obs = ch.series.find((s) => s.role === 'observed' || s.role === 'subject');
  if (!exp || !obs) return '';
  const rows = cats.map((l, i) => ({ label: l, expected: exp.values[i] ?? 0, observed: obs.values[i] ?? 0 }));
  return `<figure class="chart chart--comparison" data-chart="${esc(ch.id)}" aria-labelledby="${esc(ch.id)}-t">
    ${head(c, { kind: 'Volume against own history', id: ch.id, title: ch.title, entryId: ch.entryId, level, source: ch.source, unit: ch.unit })}
    <div class="chart__body chart__body--lanes"><p class="chart__ylab">${esc(ch.yLabel)}</p>${compareRows(rows, ch.unit, ch.id)}<p class="chart__xlab">${esc(ch.xLabel)}</p></div>
    ${key([['expected', exp.label], ['observed', obs.label], ['gap', 'Expected, not observed']])}
    ${foot(c, ch.note)}
  </figure>`;
}

// ---- (d) link diagram: subscriptions, devices, cells ----------------------------------------------------------------
const ORDER = ['party', 'subscription', 'device', 'cell', 'route', 'range'] as const;
const TYPE_NAME: Record<string, string> = { subscription: 'SIM subscriptions', device: 'Devices', cell: 'Cell areas', route: 'Routes', range: 'Number ranges', party: 'Parties called' };
export function links(c: C, ch: Chart, level: Level | null): string {
  const g = ch.graph;
  if (!g) return '';
  const cols = ORDER.filter((t) => g.nodes.some((n) => n.type === t));
  // Outer columns hug the card edges (labels align inward); edges leave and join at the label sides.
  const colX = (ci: number) => (cols.length === 1 ? 50 : (ci / (cols.length - 1)) * 100);
  const side = (ci: number) => (cols.length === 1 ? 'mid' : ci === 0 ? 'l' : ci === cols.length - 1 ? 'r' : 'mid');
  const pos = new Map<string, [number, number]>();
  const colOf = new Map<string, number>();
  cols.forEach((t, ci) => {
    const ns = g.nodes.filter((n) => n.type === t);
    ns.forEach((n, i) => { pos.set(n.id, [colX(ci), ((i + 0.5) / ns.length) * 100]); colOf.set(n.id, ci); });
  });
  const wmax = Math.max(1, ...g.edges.map((e) => e.weight));
  const edges = g.edges
    .map((e) => {
      const a = pos.get(e.from), b = pos.get(e.to);
      if (!a || !b) return '';
      return `<path class="chart__edge" style="stroke-width:${pc(1 + (e.weight / wmax) * 3)}px" d="M${pc(a[0] * 10)} ${pc(a[1] * 10)}C${pc((a[0] + b[0]) * 5)} ${pc(a[1] * 10)} ${pc((a[0] + b[0]) * 5)} ${pc(b[1] * 10)} ${pc(b[0] * 10)} ${pc(b[1] * 10)}"/>`;
    })
    .join('');
  const nodes = g.nodes.map((n) => { const p = pos.get(n.id)!; return `<span class="node node--${n.type} node--${side(colOf.get(n.id)!)}" style="--x:${p[0]};--y:${p[1]}">${esc(n.label)}</span>`; }).join('');
  const heads = cols.map((t, ci) => `<span class="chart__colhead node--${side(ci)}" style="--x:${colX(ci)}">${esc(TYPE_NAME[t] ?? t)}</span>`).join('');
  const rows = Math.max(...cols.map((t) => g.nodes.filter((n) => n.type === t).length));
  const sum = cols.map((t) => `${g.nodes.filter((n) => n.type === t).length} ${(TYPE_NAME[t] ?? t).toLowerCase()}`).join(', ');
  return `<figure class="chart chart--links" data-chart="${esc(ch.id)}" aria-labelledby="${esc(ch.id)}-t">
    ${head(c, { kind: 'Link diagram', id: ch.id, title: ch.title, entryId: ch.entryId, level, source: ch.source, unit: ch.unit })}
    <div class="chart__body chart__body--links"><div class="chart__heads">${heads}</div>${plot(edges, nodes, `${Math.max(9, rows * 2.1)}rem`)}</div>
    <p class="chart__note chart__note--key">${esc(ch.yLabel)}. ${esc(ch.xLabel)}. Line weight shows ${esc(ch.unit)}.</p>
    <p class="sr-only">${esc(sum)}. ${g.edges.length} links.</p>
    ${foot(c, ch.note)}
  </figure>`;
}

export function chartHTML(c: C, ch: Chart, level: Level | null): string {
  if (ch.kind === 'timeseries') return timeseries(c, ch, level);
  if (ch.kind === 'distribution') return distribution(c, ch, level);
  if (ch.kind === 'comparison') return comparison(c, ch, level);
  return links(c, ch, level);
}

// ---- derived graphics, used when the case file carries no chart for an exhibit -------------------------------------

/** The time strip of the group's records over the window (stage 1). Each tick is one record, in time order. */
export function stripFigure(c: C, entryId: string, level: Level | null, idp: string): string {
  const lanes = c.strip.lanes;
  const H = hoursIn(c.window);
  const min = H * 60;
  const lh = 1000 / Math.max(1, lanes.length);
  const ticks = c.strip.ticks
    .map((t, i) => `<path class="strip__tick" data-i="${i}" d="M${pc((t[0] / min) * 1000)} ${pc(t[1] * lh + lh * 0.18)}V${pc((t[1] + 1) * lh - lh * 0.18)}"/>`)
    .join('');
  const rules = lanes.map((_, i) => `M0 ${pc((i + 1) * lh)}H1000`).join('');
  const bins = Array.from({ length: H }, () => 0);
  for (const t of c.strip.ticks) bins[Math.min(H - 1, Math.floor(t[0] / 60))]!++;
  const bmax = niceScale(Math.max(...bins), 3);
  const binBars = bins.map((b, i) => `<rect class="strip__bin" data-i="${i}" x="${pc((i / H) * 1000 + 1)}" y="${pc(1000 - (b / bmax.max) * 1000)}" width="${pc(1000 / H - 2)}" height="${pc((b / bmax.max) * 1000)}"/>`).join('');
  let xt = '';
  for (let h = 0; h <= H; h += 24) xt += `<span class="chart__tick chart__tick--x" style="--x:${pc((h / H) * 100)}">${h === 0 ? 'Start' : `${h} h`}</span>`;
  const laneLabels = lanes.length <= 12 ? lanes.map((l, i) => `<span class="strip__lane" style="--y:${pc(((i + 0.5) / lanes.length) * 100)}">${esc(`SIM ${i + 1}`)}</span>`).join('') : '';
  return `<figure class="chart chart--strip" data-strip="${esc(idp)}" aria-labelledby="${esc(idp)}-t">
    ${head(c, { kind: 'Time strip', id: idp, title: `${num(c.strip.ticks.length)} answered calls by the group, in time order`, entryId, level, source: 'E1', unit: 'one mark per call record' })}
    <div class="chart__body strip__wide"><p class="chart__ylab">One row per SIM (${lanes.length})</p>
      ${plot(`<path class="strip__rules" d="${rules}"/><path class="strip__rule" d="M0 1000H1000"/>${ticks}`, laneLabels + xt, `${Math.max(7, lanes.length * 1.05)}rem`)}
      <p class="chart__xlab">Hours from the start of the ${H}-hour window</p></div>
    <div class="chart__body strip__bins"><p class="chart__ylab">Calls per hour, all SIMs of the group</p>
      ${plot(`${yGrid(bmax.max, bmax.step)}${binBars}`, yTicks(bmax.max, bmax.step) + xt, '9rem')}
      <p class="chart__xlab">Hours from the start of the ${H}-hour window</p></div>
    ${foot(c, `Each mark is one answered call record of the group, placed at the time it was answered. Detection is after the fact: these calls had already been made.`)}
  </figure>`;
}

/** An indicator as a measured bar against its ruled baseline. For a per-SIM rule the strip's ticks are packed into lanes. */
export function measureFigure(c: C, ind: Indicator, entryId: string, level: Level | null, idp: string, pack: boolean): string {
  const max = niceScale(Math.max(ind.value, ind.baseline.value) * 1.08, 5);
  const W = (x: number) => pc((x / max.max) * 100);
  let packed = '';
  if (pack && c.strip.lanes.length && c.strip.lanes.length <= 12) {
    const counts = c.strip.lanes.map(() => 0);
    const order: number[] = [];
    for (const t of c.strip.ticks) order.push(counts[t[1]]!++);
    const H = hoursIn(c.window) * 60;
    const lh = 1000 / c.strip.lanes.length;
    const unit = 1000 / max.max;
    packed = `<div class="measure__lanes"><p class="measure__sub">Each SIM's calls, packed into a bar (one mark per call)</p>${'' /* plot below */}
      <div class="chart__plot measure__plot" style="--h:${pc(c.strip.lanes.length * 0.95)}rem"><svg class="chart__svg" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      ${c.strip.ticks.map((t, i) => `<path class="strip__tick measure__tick" data-i="${i}" data-from="${pc((t[0] / H) * 1000 - (order[i]! + 0.5) * unit)}" d="M${pc((order[i]! + 0.5) * unit)} ${pc(t[1] * lh + lh * 0.16)}V${pc((t[1] + 1) * lh - lh * 0.16)}"/>`).join('')}
      </svg>${counts.map((n, i) => `<span class="measure__count" style="--y:${pc(((i + 0.5) / counts.length) * 100)};--x:${W(n)}">${n}</span>`).join('')}</div></div>`;
  }
  let ticks = '';
  for (let t = 0; t <= max.max + 1e-9; t += max.step) ticks += `<span style="--x:${W(t)}">${num(+t.toFixed(3))}</span>`;
  return `<figure class="chart chart--measure" data-measure="${esc(idp)}" aria-labelledby="${esc(idp)}-t">
    ${head(c, { kind: 'Measured against a baseline', id: idp, title: ind.description, entryId, level, source: ind.source, unit: ind.unit })}
    ${packed}
    <p class="chart__ylab measure__ylab">Measured value and its baseline</p>
    <div class="measure">
      <div class="measure__row measure__row--value"><p class="measure__k">Measured</p><div class="measure__track"><span class="measure__bar" style="--w:${W(ind.value)}"></span></div><p class="measure__n"><span class="v">${num(ind.value)}</span></p></div>
      <div class="measure__row measure__row--base"><p class="measure__k">Baseline ${ref(ind.baseline.id)}</p><div class="measure__track"><span class="measure__bar measure__bar--base" style="--w:${W(ind.baseline.value)}"></span></div><p class="measure__n"><span class="v">${num(ind.baseline.value)}</span></p></div>
      <div class="measure__scale" aria-hidden="true">${ticks}</div>
    </div>
    <p class="chart__xlab">${esc(cap(ind.unit))}</p>
    <p class="chart__note">${esc(ind.position === 'above' ? 'Above' : ind.position === 'below' ? 'Below' : 'Within')} the baseline: ${esc(ind.baseline.population)}. This is an ordering against the baseline, not a probability. <span class="chart__win">Window ${esc(windowText(ind.window))}, exercise data.</span></p>
  </figure>`;
}

/** Route volumes for every indicator that shares a rule, each against its own history (derived from the indicators). */
export function routeFigure(c: C, inds: Indicator[], entryId: string, level: Level | null, idp: string): string {
  const rows = inds.map((i) => {
    const route = /ROUTE-[A-Z0-9-]+/.exec(i.description)?.[0] ?? i.id;
    const ratio = i.unit === 'ratio of baseline count';
    return { label: `Route ${route}`, expected: i.baseline.value, observed: ratio ? Math.round(i.value * i.baseline.value) : i.value };
  });
  const src = inds[0]?.source ?? 'E2';
  return `<figure class="chart chart--comparison" data-chart="${esc(idp)}" aria-labelledby="${esc(idp)}-t">
    ${head(c, { kind: 'Volume against own history', id: idp, title: 'International calls arriving on each route, against that route’s own history', entryId, level, source: src, unit: 'calls in the window' })}
    <div class="chart__body chart__body--lanes"><p class="chart__ylab">One row per route</p>${compareRows(rows, 'calls', idp)}<p class="chart__xlab">Calls answered in the window</p></div>
    ${key([['expected', 'Expected from the route’s own earlier windows'], ['observed', 'Observed in this window'], ['gap', 'Expected, not observed']])}
    ${foot(c, 'Each route is read against its own earlier windows of the same length, not against the other routes.')}
  </figure>`;
}
