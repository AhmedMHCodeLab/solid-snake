// Rule functions, keyed by rule id, plus the rule definitions shown in each case.
// A test recomputes every Indicator.value from the records named in recordIds through RULE_FN, and every chart series
// from the records named in Chart.recordIds through CHART_FN.
import type { AnyRecord, Chart, IbcfRecord, Rule, ScscfRecord } from '../../shared/types';
import { r } from './prng';
import { PREMIUM_BLOCK } from './ident';

export interface RuleCtx {
  /** The stated baseline value of the indicator, where the rule uses one. */
  baseline: number;
}

const isS = (x: AnyRecord): x is ScscfRecord => x.recordType === 'sCSCFRecord';
export const origs = (recs: AnyRecord[]): ScscfRecord[] => recs.filter(isS).filter((x) => x.roleOfNode === 'originating');
export const cellOf = (x: ScscfRecord): string | undefined => x.userLocationInfo?.cellRef ?? x.accessNetworkInformation?.cellRef;
export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 17;
export const RANGE_TOKEN = PREMIUM_BLOCK;
export const outsideHours = (x: ScscfRecord): boolean => {
  const h = new Date(x.serviceDeliveryStartTimeStamp).getUTCHours();
  return h < BUSINESS_START_HOUR || h >= BUSINESS_END_HOUR;
};

export const RULE_FN: Record<string, (recs: AnyRecord[], ctx: RuleCtx) => number> = {
  /** R-1: mean answered outgoing calls per distinct calling SIM. */
  'R-1': (recs) => {
    const o = origs(recs);
    const sims = new Set(o.map((x) => x.listOfCallingPartyAddress));
    return sims.size === 0 ? 0 : r(o.length / sims.size, 2);
  },
  /** R-2: inbound calls counted on the route, as a ratio of the route's own baseline count for the same window. */
  'R-2': (recs, ctx) => r(recs.filter((x): x is IbcfRecord => x.recordType === 'iBCFRecord').length / ctx.baseline, 3),
  /** R-3: mean number of distinct cells per distinct calling SIM (outgoing records that carry a cell). */
  'R-3': (recs) => {
    const bySim = new Map<string, Set<string>>();
    for (const x of origs(recs)) {
      const c = cellOf(x);
      if (!c) continue;
      const s = bySim.get(x.listOfCallingPartyAddress) ?? new Set<string>();
      s.add(c);
      bySim.set(x.listOfCallingPartyAddress, s);
    }
    if (bySim.size === 0) return 0;
    let t = 0;
    for (const s of bySim.values()) t += s.size;
    return r(t / bySim.size, 2);
  },
  /** R-4: incoming records per outgoing record. */
  'R-4': (recs) => {
    const s = recs.filter(isS);
    const o = s.filter((x) => x.roleOfNode === 'originating').length;
    const t = s.filter((x) => x.roleOfNode === 'terminating').length;
    return o === 0 ? 0 : r(t / o, 3);
  },
  /** R-5: distinct called parties per 100 outgoing calls. */
  'R-5': (recs) => {
    const o = origs(recs);
    return o.length === 0 ? 0 : r((new Set(o.map((x) => x.calledPartyAddress)).size / o.length) * 100, 1);
  },
  /** R-6: outgoing calls to the premium-rate block outside business hours. */
  'R-6': (recs) => origs(recs).filter((x) => x.calledPartyAddress.includes(RANGE_TOKEN) && outsideHours(x)).length,
};

// ---- Chart rules -------------------------------------------------------------------------------------

export interface ChartCtx {
  startMs: number;
  bucketMinutes: number;
  buckets: number;
  /** Calling addresses of the subject (the group, or the trunk). */
  subject: Set<string>;
  /** comparison: route reference per category, and the stated usual level per category. */
  routeRefs?: string[];
  baselines?: number[];
}

export interface ChartCalc {
  categories?: string[];
  series: Record<string, number[]>;
  band?: { low: number[]; high: number[] };
  marker?: number;
  graph?: NonNullable<Chart['graph']>;
}

/** Calling addresses of the originating records among the given ids: the subject of a chart. */
export function subjectCallers(ids: string[], index: Map<string, AnyRecord>): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    const x = index.get(id);
    if (x && isS(x) && x.roleOfNode === 'originating') out.add(x.listOfCallingPartyAddress);
  }
  return out;
}

const bucketOf = (x: ScscfRecord, ctx: ChartCtx): number => Math.floor((Date.parse(x.serviceDeliveryStartTimeStamp) - ctx.startMs) / (ctx.bucketMinutes * 60000));
const sum = (a: number[]): number => a.reduce((s, v) => s + v, 0);

/** Comparable groups are chunks of the other callers, in address order, each as large as the subject (at least a quarter of the others). */
export function chunkSize(subjectSims: number, otherSims: number): number {
  return Math.max(1, Math.min(subjectSims, Math.floor(otherSims / 4)));
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const siteName = (cellRef: string): string => cap(`site ${cellRef.split('_')[0]}, sector ${cellRef.split('_')[1]}`);

export const CHART_FN: Record<string, (recs: AnyRecord[], ctx: ChartCtx) => ChartCalc> = {
  /** R-10: calls per SIM per bucket for the subject, against the ordinary range of comparable groups of SIMs. */
  'R-10': (recs, ctx) => {
    const per = new Map<string, number[]>();
    for (const x of origs(recs)) {
      const b = bucketOf(x, ctx);
      if (b < 0 || b >= ctx.buckets) continue;
      const a = per.get(x.listOfCallingPartyAddress) ?? new Array<number>(ctx.buckets).fill(0);
      a[b] = (a[b] as number) + 1;
      per.set(x.listOfCallingPartyAddress, a);
    }
    const subj = [...per.keys()].filter((c) => ctx.subject.has(c)).sort();
    const others = [...per.keys()].filter((c) => !ctx.subject.has(c)).sort();
    const m = chunkSize(subj.length, others.length);
    const chunks: string[][] = [];
    for (let i = 0; i + m <= others.length; i += m) chunks.push(others.slice(i, i + m));
    const at = (cs: string[], b: number): number => sum(cs.map((c) => (per.get(c) as number[])[b] as number)) / cs.length;
    const idx = Array.from({ length: ctx.buckets }, (_, b) => b);
    return {
      series: {
        subject: idx.map((b) => r(at(subj, b), 3)),
        population: idx.map((b) => r(at(others, b), 3)),
      },
      band: {
        low: idx.map((b) => r(Math.min(...chunks.map((c) => at(c, b))), 3)),
        high: idx.map((b) => r(Math.max(...chunks.map((c) => at(c, b))), 3)),
      },
    };
  },

  /** R-11: how many calls each SIM placed in the window, for the population and for the subject, in equal-width bins. */
  'R-11': (recs, ctx) => {
    const per = new Map<string, number>();
    for (const x of origs(recs)) per.set(x.listOfCallingPartyAddress, (per.get(x.listOfCallingPartyAddress) ?? 0) + 1);
    const max = Math.max(...per.values());
    const w = Math.max(1, Math.ceil(max / 10));
    const nb = Math.floor(max / w) + 1;
    const pop = new Array<number>(nb).fill(0);
    const sub = new Array<number>(nb).fill(0);
    let subTotal = 0;
    let subN = 0;
    for (const [c, n] of per) {
      const b = Math.floor(n / w);
      if (ctx.subject.has(c)) {
        sub[b] = (sub[b] as number) + 1;
        subTotal += n;
        subN++;
      } else pop[b] = (pop[b] as number) + 1;
    }
    return {
      categories: Array.from({ length: nb }, (_, i) => `${i * w} to ${i * w + w - 1}`),
      series: { population: pop, subject: sub },
      marker: r(subTotal / Math.max(1, subN), 1),
    };
  },

  /** R-12: answered inbound calls per route against the route's own usual level for a window of the same length. */
  'R-12': (recs, ctx) => {
    const refs = ctx.routeRefs as string[];
    const ib = recs.filter((x): x is IbcfRecord => x.recordType === 'iBCFRecord');
    return { series: { observed: refs.map((ref) => ib.filter((x) => x.routeRef === ref).length), expected: [...(ctx.baselines as number[])] } };
  },

  /** R-13: which SIMs, devices and cells the subject's records tie together. Only records that carry the optional field count. */
  'R-13': (recs) => {
    const nodes = new Map<string, { id: string; label: string; type: 'subscription' | 'device' | 'cell' }>();
    const edges = new Map<string, { from: string; to: string; weight: number }>();
    const link = (from: string, to: string): void => {
      const k = `${from}>${to}`;
      const e = edges.get(k) ?? { from, to, weight: 0 };
      e.weight++;
      edges.set(k, e);
    };
    for (const x of origs(recs)) {
      const sim = x.listOfSubscriptionId;
      nodes.set(sim, { id: sim, label: `SIM ending ${sim.slice(-4)}`, type: 'subscription' });
      if (x.subscriberEquipmentNumber) {
        const d = x.subscriberEquipmentNumber;
        nodes.set(d, { id: d, label: `Device ending ${d.slice(10, 14)}`, type: 'device' });
        link(sim, d);
      }
      const c = cellOf(x);
      if (c) {
        nodes.set(c, { id: c, label: siteName(c), type: 'cell' });
        link(sim, c);
      }
    }
    const byId = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return {
      series: {},
      graph: {
        nodes: [...nodes.values()].sort(byId),
        edges: [...edges.values()].sort((a, b) => (a.from + a.to < b.from + b.to ? -1 : 1)),
      },
    };
  },

  /** R-14: outgoing calls to the premium-rate block outside business hours, per day, against the identity's own usual level. */
  'R-14': (recs, ctx) => {
    const days = ctx.buckets;
    const observed = new Array<number>(days).fill(0);
    for (const x of origs(recs)) {
      if (!x.calledPartyAddress.includes(RANGE_TOKEN) || !outsideHours(x)) continue;
      const b = bucketOf(x, ctx);
      if (b >= 0 && b < days) observed[b] = (observed[b] as number) + 1;
    }
    return { series: { observed, expected: [...(ctx.baselines as number[])] } };
  },
};

export const RULE_DEFS: Record<string, Rule> = {
  'R-1': {
    id: 'R-1',
    name: 'Calls per SIM',
    description: 'Count the answered outgoing calls named by the indicator and divide by the number of different calling SIMs among them. Reported to two decimals.',
    basis: 'RESEARCH',
    sourceNote: 'Per-SIM call-count aggregates on one cell are reported by Elmi 2013 and Sallehuddin 2014, read only through Ighneiwa and Mohamed (PRODUCT.md 2.2). The window and the mean are this platform\'s choice.',
  },
  'R-2': {
    id: 'R-2',
    name: 'Inbound route against its own usual level',
    description: 'Count the answered inbound calls on one route in the window and divide by that route\'s own usual count for a window of the same length.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: BICS describes bypass as traffic diverted away from the interconnect (PRACTICE), and PRODUCT.md P6 notes the international leg is absent from the SIMs\' records. Reading inbound volume against the route\'s own history is a choice of this platform (PRODUCT.md U8).',
  },
  'R-3': {
    id: 'R-3',
    name: 'Cell areas per SIM',
    description: 'For each calling SIM, count the different cells named by its answered outgoing calls, then take the mean over SIMs. Records without a cell are skipped.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: near-static association is a widely repeated SIM-box indicator that was not verified in discovery (PRODUCT.md 2.2, U7).',
  },
  'R-4': {
    id: 'R-4',
    name: 'Incoming calls per outgoing call',
    description: 'Divide the number of incoming call records by the number of outgoing call records among the records named by the indicator.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: low inbound traffic on the SIMs is a widely repeated indicator that was not verified in discovery (PRODUCT.md 2.2, U7).',
  },
  'R-5': {
    id: 'R-5',
    name: 'Variety of called numbers',
    description: 'Count the different numbers called among the answered outgoing calls named by the indicator, divide by the number of those calls and multiply by 100.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: the breadth of a SIM group\'s called parties is a choice of this platform. PRODUCT.md 2.2 names the many-short-calls pattern without a verified measure (U7).',
  },
  'R-6': {
    id: 'R-6',
    name: 'Burst to one number block outside business hours',
    description: 'Count the answered outgoing calls whose called number starts with +99997 and whose answer time falls before 08:00 or from 17:00 onward, simulated clock.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: BICS (PRACTICE) describes revenue-share abuse as a burst of calls to one high-cost range; the business-hours cut and the window are choices of this platform (PRODUCT.md 2.2).',
  },
  'R-7': {
    id: 'R-7',
    name: 'Registration records requested',
    description: 'SIM registration records (E4) are expected back for every SIM named in a request. A request with no returned item is shown as expected, not observed.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: that registration data can be requested and returned is a choice of this platform (PRODUCT.md Part 3, workflow reconstruction).',
  },
  'R-8': {
    id: 'R-8',
    name: 'Independent check requested',
    description: 'A field survey, test call or operator record is expected back when requested. A request with no returned item is shown as expected, not observed.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: test calls and field checks are named as escalation in PRODUCT.md Part 3 and Ighneiwa and Mohamed; their return in the demo connectors is prepared.',
  },
  'R-9': {
    id: 'R-9',
    name: 'Cell area expected on records',
    description: 'Each answered record is expected to carry a cell area in one of the two optional cell fields when the operator enables them. Records without either are shown as expected, not observed.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: that the operator enables location capture is a choice of this platform. ETSI TS 132 260 Table 6.1.3.3.1 lists both fields as optional (OC, FACT), so their absence is a normal state (DECISIONS.md section 8).',
  },
  'R-10': {
    id: 'R-10',
    name: 'Calls per hour against comparable SIMs',
    description: 'For each hour from the window start, divide the answered outgoing calls of the subject by its number of SIMs. The band is the lowest and highest hourly value of comparable groups: the other SIMs, in address order, split into groups as large as the subject (at least a quarter of the others).',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: the grouping and the band are a presentation choice of this platform. The band is an ordinary range, not a threshold.',
  },
  'R-11': {
    id: 'R-11',
    name: 'Calls per SIM across the population',
    description: 'Count the answered outgoing calls of each SIM in the window and place each SIM in an equal-width bin. The marker is the subject\'s mean. It is an ordering, not a probability.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: the bin width is a presentation choice of this platform.',
  },
  'R-12': {
    id: 'R-12',
    name: 'Inbound calls per route against each route\'s own usual level',
    description: 'Count the answered inbound calls on each route in the window and set each count beside that route\'s own usual count for a window of the same length.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: reading inbound volume against the route\'s own history is a choice of this platform (PRODUCT.md U8).',
  },
  'R-13': {
    id: 'R-13',
    name: 'SIMs, devices and cells tied together',
    description: 'For each answered outgoing call of the group, link its SIM to the device and to the cell it names. Records without the optional device field add no device link.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: that the operator records the device identity is a choice of this platform. ETSI TS 132 260 Table 6.1.3.3.1 lists it as optional (OC, FACT).',
  },
  'R-14': {
    id: 'R-14',
    name: 'Calls to the premium-rate block per day against the identity\'s own history',
    description: 'Count the answered outgoing calls to the number block +99997 outside business hours on each day of the window and set each count beside the identity\'s own usual daily count.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: the business-hours cut and the daily split are choices of this platform (PRODUCT.md 2.2).',
  },
};
