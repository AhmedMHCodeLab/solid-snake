// Detection over every record of a feed. Pure and deterministic: records in, detections out.
// Generic rules only: no scenario ids, no ground truth, no knowledge of which records belong to which case.
// Parameters are illustrative, not tuned production thresholds (PRODUCT.md Part 9).
import { createHash } from 'node:crypto';
import type { AnyRecord, Detection, IbcfRecord, Rule, ScscfRecord } from '../../shared/types';
import { RULE_FN, cellOf, outsideHours } from '../seed/rules';
import type { Feed } from './feed';

const HOUR = 3_600_000;
export const LOOKBACK_HOURS = 72;
export const PARAMS = {
  /** DR-1: SIMs anchored on one cell needed to form a group, other SIMs needed for a baseline, and the factor above it. */
  minGroup: 5,
  minPopulation: 10,
  groupFactor: 2,
  /** DR-2: active hours needed inside and outside the window, and the ratio at or below which a route fires. */
  minActiveHours: 24,
  routeRatio: 0.5,
  /** DR-3: the factor above the pair's own in-hours count (at least 1) and a floor. */
  burstFactor: 5,
  burstMin: 20,
  /** DR-3: a number block is the country code and the first two digits of the national number. */
  blockDigits: 5,
  /** Every rule: it must hold at this many consecutive hourly evaluations before an alert is raised, so a group is read once its members have appeared. */
  sustainHours: 6,
};

/** The records a detection's baseline was computed from, by count and digest. baselineRecords() rebuilds them from the feed. */
export interface BaselinePopulation {
  description: string;
  count: number;
  /** sha256 over the record ids of the population, sorted and joined with commas. */
  sha256: string;
}
export type EngineDetection = Detection & { window: { start: string; end: string }; baselinePopulation: BaselinePopulation };

export const DETECTION_RULES: Rule[] = [
  {
    id: 'DR-1',
    name: 'SIM group on one cell above the population',
    description:
      'Every hour, over the last 72 hours: anchor each calling SIM to the cell that carries at least half of its located originating records. Where at least 5 SIMs share an anchor cell, compute sessions per SIM (rule R-1) over all their originating records and compare it with R-1 over every other SIM active in the window (at least 10). Fires at twice the baseline or more, once that has held for 6 hourly checks in a row.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: the measure is rule R-1 (sessions per SIM). Grouping by anchor cell, the 72-hour window and the factor of two are illustrative choices of this platform, not tuned thresholds.',
  },
  {
    id: 'DR-2',
    name: 'Inbound route below its own history',
    description:
      'Every hour, over the last 72 hours: count inbound border records per route and divide by the route\'s expected count (rule R-2). The expected count is the route\'s own rate per active hour over the rest of the loaded feed, times the active hours in the window. An active hour has at least one inbound border record on any route. Needs 24 active hours inside and outside the window. Fires at a ratio of 0.5 or less, once that has held for 6 hourly checks in a row.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: the measure is rule R-2 (inbound route ratio). Reading the rest of the loaded feed as the route\'s history is retrospective, which fits a platform that reviews loaded records (PRODUCT.md P4).',
  },
  {
    id: 'DR-3',
    name: 'Out-of-hours burst to one number range',
    description:
      'Every hour, over the last 72 hours: for each calling identity and called number block (country code and the first two digits of the national number), count answered originating records before 08:00 or from 17:00 onward. Compare with the same pair\'s records inside business hours in the window, taken as at least 1. Fires at five times that count and at least 20 records, once that has held for 6 hourly checks in a row.',
    basis: 'ASSUMPTION',
    sourceNote: 'ASSUMPTION: rule R-6 applied to any number block, not one named block, and read against the pair\'s own business-hours traffic. The factor, the floor and the window are illustrative choices of this platform.',
  },
];

const isS = (x: AnyRecord): x is ScscfRecord => x.recordType === 'sCSCFRecord';
const isInbound = (x: AnyRecord): x is IbcfRecord => x.recordType === 'iBCFRecord' && x.nniInformation.sessionDirection === 'inbound';
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 19) + 'Z';

/** Number block of an E.164 called address, for example sip:+99997123...@... gives +99997. */
export function numberBlock(address: string): string | null {
  const m = /^(?:sip|tel):(\+\d+)/.exec(address);
  return m && (m[1] as string).length > PARAMS.blockDigits + 1 ? (m[1] as string).slice(0, PARAMS.blockDigits + 1) : null;
}
const origOf = (x: AnyRecord): x is ScscfRecord => isS(x) && x.roleOfNode === 'originating';

/** Recomputes a detection value from its records, the way a reviewer would. */
export function detectionValue(d: Pick<Detection, 'ruleId' | 'baseline' | 'subject'>, recs: AnyRecord[]): number {
  if (d.ruleId === 'DR-1') return (RULE_FN['R-1'] as (r: AnyRecord[], c: { baseline: number }) => number)(recs, { baseline: 0 });
  if (d.ruleId === 'DR-2') return (RULE_FN['R-2'] as (r: AnyRecord[], c: { baseline: number }) => number)(recs, { baseline: d.baseline.value });
  if (d.ruleId === 'DR-3') return recs.filter((x) => origOf(x) && outsideHours(x) && numberBlock(x.calledPartyAddress) === d.subject.ref.split('|')[1]).length;
  throw new Error('unknown detection rule');
}

const round = (v: number, d: number): number => Math.round(v * 10 ** d) / 10 ** d;

interface Candidate {
  ruleId: string;
  ref: string;
  build: () => Omit<EngineDetection, 'id' | 'baselinePopulation'>;
}

export const digestOf = (recs: AnyRecord[]): string => createHash('sha256').update(recs.map((x) => x.id).sort().join(',')).digest('hex');

/**
 * The population a detection's baseline was computed from, rebuilt from the feed with the detection's own rule, window
 * and subject. A reviewer recomputes the baseline value from these records.
 *   DR-1: every originating record in the window by a SIM that is not in the group.
 *   DR-2: every inbound record on the route outside the window.
 *   DR-3: the line's originating records to the number block inside business hours in the window.
 */
export function baselineRecords(d: Pick<EngineDetection, 'ruleId' | 'subject' | 'window' | 'recordIds'>, feed: Feed): AnyRecord[] {
  const t0 = Date.parse(d.window.start);
  const t1 = Date.parse(d.window.end);
  const inWindow = (i: number): boolean => (feed.times[i] as number) >= t0 && (feed.times[i] as number) < t1;
  if (d.ruleId === 'DR-1') {
    const ids = new Set(d.recordIds);
    const group = new Set(feed.records.filter((x) => ids.has(x.id) && origOf(x)).map((x) => (x as ScscfRecord).listOfCallingPartyAddress));
    return feed.records.filter((x, i) => inWindow(i) && origOf(x) && !group.has(x.listOfCallingPartyAddress));
  }
  if (d.ruleId === 'DR-2') return feed.records.filter((x, i) => isInbound(x) && x.routeRef === d.subject.ref && !inWindow(i));
  if (d.ruleId === 'DR-3') {
    const [caller, block] = d.subject.ref.split('|') as [string, string];
    return feed.records.filter((x, i) => inWindow(i) && origOf(x) && x.listOfCallingPartyAddress === caller && numberBlock(x.calledPartyAddress) === block && !outsideHours(x));
  }
  throw new Error('unknown detection rule');
}

export function detect(feed: Feed): EngineDetection[] {
  const start = Date.parse(feed.window.start);
  const hours = Math.round((Date.parse(feed.window.end) - start) / HOUR);
  const bucket = (t: number): number => Math.floor((t - start) / HOUR);

  // Hour buckets of the record kinds each rule reads.
  const orig: ScscfRecord[][] = Array.from({ length: hours }, () => []);
  const inbound: IbcfRecord[][] = Array.from({ length: hours }, () => []);
  const ranged: ScscfRecord[][] = Array.from({ length: hours }, () => []);
  feed.records.forEach((x, i) => {
    const b = bucket(feed.times[i] as number);
    if (b < 0 || b >= hours) return;
    if (origOf(x)) {
      (orig[b] as ScscfRecord[]).push(x);
      if (numberBlock(x.calledPartyAddress)) (ranged[b] as ScscfRecord[]).push(x);
    } else if (isInbound(x)) (inbound[b] as IbcfRecord[]).push(x);
  });
  const routes = [...new Set(inbound.flat().map((x) => x.routeRef))].sort();
  const active: number[] = inbound.map((b) => (b.length > 0 ? 1 : 0));
  const totalActive = active.reduce((a, b) => a + b, 0);
  const routeTotal = new Map(routes.map((r) => [r, inbound.flat().filter((x) => x.routeRef === r).length]));

  const slice = <T>(arr: T[][], k: number): T[] => arr.slice(Math.max(0, k - LOOKBACK_HOURS), k).flat();

  function evaluate(k: number): Candidate[] {
    const T = start + k * HOUR;
    const window = { start: iso(Math.max(start, T - LOOKBACK_HOURS * HOUR)), end: iso(T) };
    const out: Candidate[] = [];

    // DR-1
    const o = slice(orig, k);
    type Sim = { recs: ScscfRecord[]; cells: Map<string, number>; located: number };
    const bySim = new Map<string, Sim>();
    for (const x of o) {
      const s: Sim = bySim.get(x.listOfCallingPartyAddress) ?? { recs: [], cells: new Map(), located: 0 };
      s.recs.push(x);
      const c = cellOf(x);
      if (c) {
        s.cells.set(c, (s.cells.get(c) ?? 0) + 1);
        s.located++;
      }
      bySim.set(x.listOfCallingPartyAddress, s);
    }
    const anchored = new Map<string, string[]>();
    for (const [sim, s] of bySim) {
      let best: [string, number] | null = null;
      for (const [c, n] of [...s.cells].sort((a, b) => (a[0] < b[0] ? -1 : 1))) if (!best || n > best[1]) best = [c, n];
      if (best && best[1] * 2 >= s.located) anchored.set(best[0], [...(anchored.get(best[0]) ?? []), sim]);
    }
    for (const [cell, sims] of [...anchored].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (sims.length < PARAMS.minGroup || bySim.size - sims.length < PARAMS.minPopulation) continue;
      const inGroup = new Set(sims);
      const groupRecs = sims.flatMap((s) => (bySim.get(s) as { recs: ScscfRecord[] }).recs);
      const restRecs = o.filter((x) => !inGroup.has(x.listOfCallingPartyAddress));
      const value = (RULE_FN['R-1'] as (r: AnyRecord[], c: { baseline: number }) => number)(groupRecs, { baseline: 0 });
      const baseline = (RULE_FN['R-1'] as (r: AnyRecord[], c: { baseline: number }) => number)(restRecs, { baseline: 0 });
      if (!(baseline > 0 && value >= PARAMS.groupFactor * baseline)) continue;
      out.push({
        ruleId: 'DR-1',
        ref: `SIMS@${cell}`,
        build: () => ({
          ruleId: 'DR-1',
          at: iso(T),
          subject: { kind: 'subscription-group', ref: `SIMS@${cell}`, plainName: `${sims.length} SIMs anchored on cell ${cell}` },
          value,
          unit: 'sessions per SIM',
          baseline: { value: baseline, description: `Sessions per SIM for the other ${bySim.size - sims.length} SIMs active in the same 72 hours` },
          position: 'above',
          recordIds: groupRecs.map((x) => x.id).sort(),
          window,
        }),
      });
    }

    // DR-2
    const winActive = active.slice(Math.max(0, k - LOOKBACK_HOURS), k).reduce((a, b) => a + b, 0);
    const outActive = totalActive - winActive;
    if (winActive >= PARAMS.minActiveHours && outActive >= PARAMS.minActiveHours) {
      const inb = slice(inbound, k);
      for (const route of routes) {
        const recs = inb.filter((x) => x.routeRef === route);
        const expected = round((((routeTotal.get(route) as number) - recs.length) / outActive) * winActive, 1);
        if (expected <= 0) continue;
        const value = (RULE_FN['R-2'] as (r: AnyRecord[], c: { baseline: number }) => number)(recs, { baseline: expected });
        if (value > PARAMS.routeRatio) continue;
        out.push({
          ruleId: 'DR-2',
          ref: route,
          build: () => ({
            ruleId: 'DR-2',
            at: iso(T),
            subject: { kind: 'route', ref: route, plainName: `International route ${route}` },
            value,
            unit: 'ratio of expected count',
            baseline: { value: expected, description: `Inbound records expected on ${route} in ${winActive} active hours, from its own rate over the rest of the loaded feed` },
            position: 'below',
            recordIds: recs.map((x) => x.id).sort(),
            window,
          }),
        });
      }
    }

    // DR-3
    const pairs = new Map<string, { out: ScscfRecord[]; inHours: number }>();
    for (const x of slice(ranged, k)) {
      const key = `${x.listOfCallingPartyAddress}|${numberBlock(x.calledPartyAddress)}`;
      const p = pairs.get(key) ?? { out: [], inHours: 0 };
      if (outsideHours(x)) p.out.push(x);
      else p.inHours++;
      pairs.set(key, p);
    }
    for (const [key, { out: recs, inHours }] of [...pairs].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      const baseline = Math.max(1, inHours);
      if (recs.length < PARAMS.burstMin || recs.length < PARAMS.burstFactor * baseline) continue;
      const [caller, block] = key.split('|') as [string, string];
      out.push({
        ruleId: 'DR-3',
        ref: key,
        build: () => ({
          ruleId: 'DR-3',
          at: iso(T),
          subject: { kind: 'number-range', ref: key, plainName: `Number block ${block}, calls from ${caller.replace(/^sip:/, '').replace(/[@;].*$/, '')}` },
          value: recs.length,
          unit: 'sessions outside business hours',
          baseline: { value: baseline, description: `The same line's sessions to ${block} inside business hours in the same 72 hours, taken as at least 1` },
          position: 'above',
          recordIds: recs.map((x) => x.id).sort(),
          window,
        }),
      });
    }
    return out;
  }

  // One detection per episode: a subject fires once its rule has held for sustainHours in a row, and again only after a full quiet window.
  const run = new Map<string, { last: number; len: number; fired: boolean }>();
  const found: Omit<EngineDetection, 'id'>[] = [];
  const populationWords: Record<string, string> = {
    'DR-1': 'originating records of every other SIM in the window',
    'DR-2': 'inbound records on the route outside the window',
    'DR-3': "the same line's records to the number block inside business hours in the window",
  };
  for (let k = 1; k <= hours; k++) {
    for (const c of evaluate(k)) {
      const key = `${c.ruleId}|${c.ref}`;
      let r = run.get(key);
      if (!r || k - r.last > LOOKBACK_HOURS) r = { last: k, len: 1, fired: false };
      else r = { last: k, len: k - r.last === 1 ? r.len + 1 : 1, fired: r.fired };
      if (!r.fired && r.len >= PARAMS.sustainHours) {
        const d = c.build();
        const pop = baselineRecords(d, feed);
        found.push({ ...d, baselinePopulation: { description: populationWords[d.ruleId] as string, count: pop.length, sha256: digestOf(pop) } });
        r.fired = true;
      }
      run.set(key, r);
    }
  }
  found.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : a.subject.ref < b.subject.ref ? -1 : 1));
  return found.map((d, i) => ({ id: `DET-${String(i + 1).padStart(4, '0')}`, ...d }));
}
