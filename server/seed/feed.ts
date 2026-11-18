// data/generated/feed.ndjson: the synthetic feed the platform ingests. One record per line, in the record shapes an
// operator export would have. It holds (1) ordinary traffic of a national sample of SIMs over the whole feed window and
// (2) all four scenario record sets, interleaved by serviceDeliveryStartTimeStamp. Nothing in it marks a scenario: a
// detection rule sees one stream. Everything is seeded and reproducible.
//
// Generator choices, stated plainly (they are generator logic, not detection logic):
//  - Ordinary traffic follows the diurnal weights BG_HOURS, about 2.5 outgoing calls and 1.5 incoming calls per SIM per
//    day, 55 percent of outgoing calls between two SIMs of the sample.
//  - Inbound international calls follow the three routes' usual daily level. On the 72-hour windows of cases A to C the
//    scenario record sets already carry those routes, so the ordinary generator skips those days (case D has no inbound
//    international records of its own, so its days are filled by the ordinary generator).
//  - On the scenario windows the ordinary population is thinned by the volume the scenario record sets add, so the daily
//    total of the feed stays level and a window is not visible as a bump in volume.
//  - Three ordinary behaviours outside every scenario window look unusual to the generic rules and are legitimate: a courier
//    depot whose six SIMs place far more calls than the rest from one cell (rule DR-1), a business line that runs an
//    evening reminder campaign (DR-3), and a carrier route that is drained for planned maintenance with its traffic
//    re-homed on the other two routes (DR-2). The platform has no connector data for them; an analyst dismisses them.
import type { AnyRecord, CaseFile, CaseId, IbcfRecord, ScscfRecord } from '../../shared/types';
import { Rng, subSeed } from './prng';
import { BG_HOURS, durBg, expand, ibcfRecord, leg, makeSim, setupSecs, simPool, WINDOW_STARTS } from './records';
import type { Leg, Sec, Sess, Sim } from './records';
import { IN_ROUTES, PREMIUM_BLOCK, cellIds, destUri, intlCallerUri, peerUri, subUri } from './ident';

export const FEED_START = '2031-03-04T00:00:00Z';
export const FEED_END = '2031-03-28T00:00:00Z';
export const FEED_DAYS = 24;
const DAY = 86400_000;
const START = Date.parse(FEED_START);
/** Sample size per operator and the mean daily calls per SIM. */
const SIMS_PER_OPERATOR = 75;
const SITES = 24;
const OUT_PER_DAY = 2.5;
const IN_PER_DAY = 1.5;
const ROUTE_PER_DAY = [87, 70, 80];

const dayOf = (iso: string): number => Math.floor((Date.parse(iso) - START) / DAY);
const scenarioDays = (): Map<number, CaseId> => {
  const m = new Map<number, CaseId>();
  (['a', 'b', 'c', 'd'] as CaseId[]).forEach((id) => {
    const d0 = Math.floor((Date.parse(WINDOWS[id]) - START) / DAY);
    for (let k = 0; k < 3; k++) m.set(d0 + k, id);
  });
  return m;
};
const WINDOWS: Record<CaseId, string> = { a: WINDOW_STARTS.A as string, b: WINDOW_STARTS.B as string, c: WINDOW_STARTS.C as string, d: WINDOW_STARTS.D as string };

function sectorsOf(L: string): Sec[] {
  const out: Sec[] = [];
  for (let site = 0; site < SITES; site++) {
    for (let n = 1; n <= 3; n++) {
      const c = cellIds(L, site, n);
      out.push({ cellRef: c.cellRef, apex: [0, 0], azimuthDeg: 0, beamwidthDeg: 0, rangeKm: 0, basis: 'ASSUMPTION', site, ecgi: c.ecgi, tai: c.tai });
    }
  }
  return out;
}

const pickLoc = (rng: Rng): Leg['loc'] => {
  const x = rng.next();
  return x < 0.86 ? 'ul' : x < 0.91 ? 'an' : x < 0.96 ? 'ad' : null;
};

/** Days of the feed (0 is FEED_START) on which the ordinary behaviours below run. Every one lies outside a scenario window. */
const DEPOT_DAYS = [4, 5, 6];
const CAMPAIGN_DAYS = [10, 11, 12];
export const DRAIN_DAYS = [18, 19, 20];
const DRAINED_ROUTE = 1;

/** Ordinary behaviours that the generic rules flag and an analyst can explain. Own random stream: the population is untouched. */
function ordinaryBehaviours(L: 'N' | 'M', seed: number, sectors: Sec[]): Sess[] {
  const rng = new Rng(subSeed(seed, `feed-ordinary-${L}`));
  const out: Sess[] = [];
  if (L === 'M') {
    // A courier depot: six SIMs on one cell, about sixteen calls a day each, for three days.
    const depot = sectors.find((x) => x.cellRef === cellIds(L, 7, 2).cellRef) as Sec;
    const sims = [9011, 9012, 9013, 9014, 9015, 9016].map((n) => makeSim(L, n, depot, 'F1', rng));
    for (const s of sims) {
      for (const d of DEPOT_DAYS) {
        const n = rng.int(14, 18);
        for (let i = 0; i < n; i++) {
          const t = START + d * DAY + (rng.weighted(BG_HOURS) * 3600 + rng.int(0, 3599)) * 1000;
          out.push({ t, setup: setupSecs(rng), dur: durBg(rng), caller: s.uri, callee: peerUri('dom', L, rng.int(1, 3000)), orig: leg(s, depot, pickLoc(rng)) });
        }
      }
      for (let i = 0; i < 3; i++) out.push({ t: START + rng.pick(DEPOT_DAYS) * DAY + (rng.weighted(BG_HOURS) * 3600 + rng.int(0, 3599)) * 1000, setup: setupSecs(rng), dur: durBg(rng), caller: peerUri('ext', L, rng.int(1, 3000)), callee: s.uri, term: leg(s, depot, pickLoc(rng)) });
    }
  } else {
    // An appointment-reminder line: twenty evening calls a day for three days, two calls in business hours.
    const line = makeSim(L, 9101, rng.pick(sectors), 'F1', rng);
    for (const d of CAMPAIGN_DAYS) {
      for (let i = 0; i < 20; i++) {
        const t = START + d * DAY + (17.5 * 3600 + rng.int(0, 4 * 3600)) * 1000;
        out.push({ t, setup: setupSecs(rng), dur: rng.int(20, 70), caller: line.uri, callee: peerUri('dom', L, rng.int(1, 3000)), orig: leg(line, line.home, 'ul') });
      }
    }
    for (const d of [CAMPAIGN_DAYS[1] as number]) for (let i = 0; i < 2; i++) out.push({ t: START + d * DAY + (10 * 3600 + rng.int(0, 3599)) * 1000, setup: setupSecs(rng), dur: rng.int(20, 70), caller: line.uri, callee: peerUri('dom', L, rng.int(1, 3000)), orig: leg(line, line.home, 'ul') });
  }
  return out;
}

function population(L: 'N' | 'M', seed: number): { sessions: Sess[] } {
  const rng = new Rng(subSeed(seed, `feed-pop-${L}`));
  const sectors = sectorsOf(L);
  const nums = simPool(rng, SIMS_PER_OPERATOR);
  const sims: Sim[] = nums.map((n) => makeSim(L, n, rng.pick(sectors), 'F1', rng));
  const sameSite = (home: Sec): Sec[] => sectors.filter((x) => x.site === home.site);
  const legOf = (s: Sim): Leg => leg(s, rng.chance(0.7) ? (s.home as Sec) : rng.pick(sameSite(s.home as Sec)), pickLoc(rng));
  const time = (): number => START + rng.int(0, FEED_DAYS - 1) * DAY + (rng.weighted(BG_HOURS) * 3600 + rng.int(0, 3599)) * 1000;
  const sessions: Sess[] = [];
  for (const s of sims) {
    const nOut = rng.poisson(OUT_PER_DAY * FEED_DAYS);
    for (let i = 0; i < nOut; i++) {
      const t = time();
      const dur = rng.chance(0.03) ? null : durBg(rng);
      if (rng.chance(0.55)) {
        const peer = rng.pick(sims.filter((x) => x !== s));
        sessions.push({ t, setup: setupSecs(rng), dur, caller: s.uri, callee: peer.uri, orig: legOf(s), term: legOf(peer) });
      } else {
        const callee = rng.chance(0.004) ? destUri(PREMIUM_BLOCK, rng.int(1, 9999)) : peerUri('dom', L, rng.int(1, 3000));
        sessions.push({ t, setup: setupSecs(rng), dur, caller: s.uri, callee, orig: legOf(s) });
      }
    }
    const nIn = rng.poisson(IN_PER_DAY * FEED_DAYS);
    for (let i = 0; i < nIn; i++) sessions.push({ t: time(), setup: setupSecs(rng), dur: rng.chance(0.03) ? null : durBg(rng), caller: peerUri('ext', L, rng.int(1, 3000)), callee: s.uri, term: legOf(s) });
  }
  sessions.push(...ordinaryBehaviours(L, seed, sectors));
  return { sessions };
}

const recCount = (s: Sess): number => (s.orig ? 1 : 0) + (s.term ? 1 : 0);

/** Every record of the feed (scenario and ordinary) sorted by answer time, with generator labels for ids. generate.ts numbers them. */
export function buildFeed(seed: number, cases: Record<CaseId, CaseFile>): { records: AnyRecord[]; scenario: number; background: number } {
  const sDays = scenarioDays();
  // Scenario records per day.
  const scenarioPerDay = new Array<number>(FEED_DAYS).fill(0);
  const all: AnyRecord[] = [];
  for (const id of ['a', 'b', 'c', 'd'] as CaseId[]) for (const x of [...cases[id].records.scscf, ...cases[id].records.ibcf]) {
    all.push(x);
    const d = dayOf(x.serviceDeliveryStartTimeStamp);
    if (x.recordType === 'sCSCFRecord' && d >= 0 && d < FEED_DAYS) scenarioPerDay[d] = (scenarioPerDay[d] as number) + 1;
  }
  const scenario = all.length;

  // Ordinary traffic of two operators, thinned on scenario days.
  const pops: { L: 'N' | 'M'; sessions: Sess[] }[] = (['N', 'M'] as const).map((L) => ({ L, sessions: population(L, seed).sessions }));
  const perDay = new Array<number>(FEED_DAYS).fill(0);
  for (const p of pops) for (const s of p.sessions) {
    const d = Math.floor((s.t - START) / DAY);
    perDay[d] = (perDay[d] as number) + recCount(s);
  }
  const plain = perDay.filter((_, d) => !sDays.has(d));
  const level = plain.reduce((a, v) => a + v, 0) / plain.length;
  const thin = new Rng(subSeed(seed, 'feed-thin'));
  const keep = (s: Sess): boolean => {
    const d = Math.floor((s.t - START) / DAY);
    if (!sDays.has(d)) return true;
    const p = Math.max(0.2, Math.min(1, (level - (scenarioPerDay[d] as number)) / (perDay[d] as number)));
    return thin.chance(p);
  };
  const background: AnyRecord[] = [];
  for (const p of pops) {
    const { records } = expand(p.L, seed, p.sessions.filter(keep));
    background.push(...(records as ScscfRecord[]));
  }

  // Inbound international calls on the three routes, at their usual daily level.
  const ibRng = new Rng(subSeed(seed, 'feed-routes'));
  const routeDays = [...Array(FEED_DAYS).keys()].filter((d) => !(sDays.has(d) && sDays.get(d) !== 'd'));
  const pending: { t: number; route: string }[] = [];
  IN_ROUTES.forEach((rt, k) => {
    for (const d of routeDays) {
      // Planned maintenance: the drained route carries a fifth of its usual calls; the other two carry the difference.
      const drain = DRAIN_DAYS.includes(d) ? (k === DRAINED_ROUTE ? 0.2 : 1.4) : 1;
      const n = Math.round((ROUTE_PER_DAY[k] as number) * drain * (0.92 + ibRng.next() * 0.16));
      for (let i = 0; i < n; i++) pending.push({ t: START + d * DAY + (ibRng.weighted(BG_HOURS) * 3600 + ibRng.int(0, 3599)) * 1000, route: rt.ref });
    }
  });
  pending.sort((a, b) => a.t - b.t || (a.route < b.route ? -1 : 1));
  const ibcf: IbcfRecord[] = pending.map((p, i) =>
    ibcfRecord('N', i + 1, {
      t: p.t,
      setup: setupSecs(ibRng),
      dur: durBg(ibRng),
      caller: intlCallerUri(p.route, ibRng.int(1, 900)),
      callee: subUri('N', ibRng.int(1, 9999)),
      dir: 'inbound',
      route: p.route,
      rng: ibRng,
      seed,
    }),
  );
  background.push(...ibcf);

  all.push(...background);
  all.sort((a, b) => (a.serviceDeliveryStartTimeStamp < b.serviceDeliveryStartTimeStamp ? -1 : a.serviceDeliveryStartTimeStamp > b.serviceDeliveryStartTimeStamp ? 1 : a.id < b.id ? -1 : 1));
  return { records: all, scenario, background: background.length };
}
