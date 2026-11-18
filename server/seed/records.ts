// Synthetic records for E1 (S-CSCF) and E2 (IBCF). Ids made here are generator labels only: generate.ts replaces every one
// with a neutral platform id (see neutralIds) before anything is written.
// Every value is FICTION. Identifiers are real-shaped but built on code
// spaces that belong to nobody (MCC 999, country code +999, test-range TACs): see ident.ts for the schemes and sources.
import type { IbcfRecord, Point, ScscfRecord } from '../../shared/types';
import { Rng, pad, r, subSeed } from './prng';
import { IN_ROUTES, NETS, OUT_ROUTE, PREMIUM_BLOCK, STD_BLOCK_PREFIXES, accessCellId, cellIds, destUri, homeOf, imei, imeiUrn, intlCallerUri, peerUri, routeDef, sbcHost, subId, subUri, trunkSubId, trunkUri } from './ident';
export { peerUri, subId, subUri };

export const WINDOW_HOURS = 72;
export const WINDOW_STARTS: Record<string, string> = { A: '2031-03-04T00:00:00Z', B: '2031-03-11T00:00:00Z', C: '2031-03-18T00:00:00Z', D: '2031-03-25T00:00:00Z' };
export const startMs = (L: string): number => Date.parse(WINDOW_STARTS[L] as string);
export const endIso = (L: string): string => iso(startMs(L) + WINDOW_HOURS * 3600_000);
export const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 19) + 'Z';

export interface Sec {
  cellRef: string;
  apex: Point;
  azimuthDeg: number;
  beamwidthDeg: number;
  rangeKm: number;
  basis: 'ASSUMPTION';
  site: number;
  ecgi: string;
  tai: string;
}
export interface Layout {
  sectors: Sec[];
  lead: Sec;
  second: Sec;
}

const SITE_APEX: Record<string, Point[]> = {
  A: [[4.6, 6.2], [9.0, 3.4], [2.6, 9.6]],
  B: [[5.8, 5.4], [9.4, 8.6], [2.8, 2.6]],
  C: [[4.2, 5.0], [8.4, 8.4], [8.8, 2.6]],
};

export function makeLayout(L: string, rng: Rng): Layout {
  const apexes = SITE_APEX[L] as Point[];
  const sectors: Sec[] = [];
  apexes.forEach((a, site) => {
    const apex: Point = [r(a[0] + rng.range(-0.3, 0.3), 2), r(a[1] + rng.range(-0.3, 0.3), 2)];
    const rangeKm = r(site === 0 ? rng.range(3.0, 3.3) : rng.range(2.4, 2.9), 2);
    for (let n = 1; n <= 6; n++) {
      sectors.push({
        cellRef: cellIds(L, site, n).cellRef,
        apex,
        azimuthDeg: n * 60 - 30,
        beamwidthDeg: 70,
        rangeKm,
        basis: 'ASSUMPTION',
        site,
        ecgi: cellIds(L, site, n).ecgi,
        tai: cellIds(L, site, n).tai,
      });
    }
  });
  return { sectors, lead: sectors[1] as Sec, second: sectors[2] as Sec };
}

// ---- Sessions -------------------------------------------------------------------------------------

export type LocMode = 'ul' | 'an' | 'ad' | null;
export interface Leg {
  uri: string;
  subId: string;
  sec: Sec | null;
  loc: LocMode;
  equip?: string;
}
export interface Sess {
  t: number;
  setup: number;
  /** Seconds, or null when the release time stamp is absent. */
  dur: number | null;
  caller: string;
  callee: string;
  orig?: Leg;
  term?: Leg;
}

export const BG_HOURS = [1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 8, 8, 8, 8, 8, 8, 9, 9, 9, 8, 6, 4, 2];
export const FLAT_HOURS = [3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 4, 3];
export const OFFICE_HOURS = [1, 1, 1, 1, 1, 1, 1, 1, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 1, 1, 1, 1];
export const UNIFORM_HOURS = new Array<number>(24).fill(1);

export function pickTime(rng: Rng, L: string, weights: readonly number[], days = 3): number {
  const day = rng.int(0, days - 1);
  const h = rng.weighted(weights);
  return startMs(L) + ((day * 24 + h) * 3600 + rng.int(0, 3599)) * 1000;
}

export function pickLoc(rng: Rng): LocMode {
  const x = rng.next();
  return x < 0.86 ? 'ul' : x < 0.91 ? 'an' : x < 0.96 ? 'ad' : null;
}

export const equipToken = (_L: string, family: string, n: number): string => imei(family, n);

export interface Sim {
  n: number;
  uri: string;
  subId: string;
  home: Sec | null;
  equip: string;
}

/** Draws distinct four-digit numbers so identifiers carry no order that could reveal membership. */
export function simPool(rng: Rng, count: number): number[] {
  const all: number[] = [];
  for (let i = 1; i <= 9000; i++) all.push(i);
  return rng.shuffle(all).slice(0, count);
}

export function makeSim(L: string, n: number, home: Sec | null, family: string, rng: Rng): Sim {
  return { n, uri: subUri(L, n), subId: subId(L, n), home, equip: equipToken(L, family, rng.int(1, 999999)) };
}

export const leg = (s: Sim, sec: Sec | null, loc: LocMode, withEquip = true): Leg => ({ uri: s.uri, subId: s.subId, sec, loc, ...(withEquip ? { equip: s.equip } : {}) });

export interface Expanded {
  sess: Sess;
  sessionId: string;
  icid: string;
  orig?: ScscfRecord;
  term?: ScscfRecord;
}

const nodesOf = (L: string): string[] => [1, 2, 3].map((i) => `scscf0${i}.${homeOf(L).domain}`);
const hex = (seed: number, label: string, len: number): string => {
  let out = '';
  for (let i = 0; out.length < len; i++) out += subSeed(seed, `${label}#${i}`).toString(16).padStart(8, '0');
  return out.slice(0, len);
};
/** 16 hex digits that always start with a letter, so an identifier never reads as a digit run. */
const icidHex = (seed: number, label: string): string => 'abcdef'[parseInt(hex(seed, label, 1), 16) % 6] + hex(seed, label, 16).slice(1);
/** Diameter Session-Id: DiameterIdentity;high32;low32 (RFC 6733 section 8.8). */
const diameterSession = (host: string, tMs: number, counter: number): string => `${host};${Math.floor(tMs / 1000)};${counter}`;

export function expand(L: string, seed: number, sessions: Sess[]): { records: ScscfRecord[]; expanded: Expanded[] } {
  const rng = new Rng(subSeed(seed, `expand-${L}`));
  const NODES = nodesOf(L);
  const sorted = sessions.map((s, i) => ({ s, i })).sort((a, b) => a.s.t - b.s.t || a.i - b.i);
  const seq = new Map<string, number>();
  const records: ScscfRecord[] = [];
  const expanded: Expanded[] = [];
  let recN = 0;
  sorted.forEach(({ s }, k) => {
    const pickNode = (uri: string): string => NODES[[...uri].reduce((a, c) => a + c.charCodeAt(0), 0) % NODES.length] as string;
    const sessionId = diameterSession(pickNode(((s.orig ?? s.term) as Leg).uri), s.t, k + 1);
    const icid = `${icidHex(seed, `icid-${L}-${k}`)}@${homeOf(L).domain}`;
    const mk = (role: 'originating' | 'terminating', lg: Leg): ScscfRecord => {
      const node = pickNode(lg.uri);
      const n = (seq.get(node) ?? 0) + 1;
      seq.set(node, n);
      recN++;
      const start = s.t + s.setup * 1000;
      const rec: ScscfRecord = {
        simulated: true,
        id: `REC-${L}-${pad(recN, 6)}`,
        recordType: 'sCSCFRecord',
        roleOfNode: role,
        nodeAddress: node,
        sessionId,
        imsChargingIdentifier: icid,
        localRecordSequenceNumber: n,
        listOfCallingPartyAddress: s.caller,
        listOfSubscriptionId: lg.subId,
        calledPartyAddress: s.callee,
        serviceRequestTimeStamp: iso(s.t),
        serviceDeliveryStartTimeStamp: iso(start),
        causeForRecordClosing: 'serviceDeliveryEndSuccessfully',
        serviceReasonReturnCode: 2001,
      };
      if (rng.chance(0.4)) rec.requestedPartyAddress = s.callee;
      if (s.dur !== null) rec.serviceDeliveryEndTimeStamp = iso(start + s.dur * 1000);
      if (lg.sec && lg.loc === 'ul') rec.userLocationInfo = { tai: lg.sec.tai, ecgi: lg.sec.ecgi, cellRef: lg.sec.cellRef };
      if (lg.sec && (lg.loc === 'an' || lg.loc === 'ad')) {
        rec.accessNetworkInformation = { value: `3GPP-E-UTRAN-FDD; utran-cell-id-3gpp=${accessCellId(lg.sec.ecgi, lg.sec.tai)}`, supplier: lg.loc === 'an' ? 'network-provided' : 'device-reported', cellRef: lg.sec.cellRef };
      }
      if (lg.equip && rng.chance(0.3)) rec.subscriberEquipmentNumber = lg.equip;
      if (lg.equip && rng.chance(0.12)) rec.instanceId = imeiUrn(lg.equip);
      if (role === 'originating' && rng.chance(0.5)) rec.originatingIoi = homeOf(L).domain;
      if (role === 'terminating' && rng.chance(0.5)) rec.terminatingIoi = homeOf(L).domain;
      records.push(rec);
      return rec;
    };
    const ex: Expanded = { sess: s, sessionId, icid };
    if (s.orig) ex.orig = mk('originating', s.orig);
    if (s.term) ex.term = mk('terminating', s.term);
    expanded.push(ex);
  });
  return { records, expanded };
}

export function ibcfRecord(L: string, n: number, p: { t: number; setup: number; dur: number; caller: string; callee: string; dir: 'inbound' | 'outbound'; route: string; sessionId?: string; icid?: string; rng: Rng; seed: number }): IbcfRecord {
  const start = p.t + p.setup * 1000;
  const rd = routeDef(p.route);
  const rec: IbcfRecord = {
    simulated: true,
    id: `IBCF-${L}-${pad(n, 6)}`,
    recordType: 'iBCFRecord',
    roleOfNode: p.dir === 'inbound' ? 'terminating' : 'originating',
    nodeAddress: `ibcf01.${homeOf(L).domain}`,
    sessionId: p.sessionId ?? diameterSession(`ibcf01.${homeOf(L).domain}`, p.t, n),
    imsChargingIdentifier: p.icid ?? `${icidHex(p.seed, `icid-ibcf-${L}-${n}`)}@${homeOf(L).domain}`,
    listOfCallingPartyAddress: p.caller,
    calledPartyAddress: p.callee,
    serviceRequestTimeStamp: iso(p.t),
    serviceDeliveryStartTimeStamp: iso(start),
    serviceDeliveryEndTimeStamp: iso(start + p.dur * 1000),
    nniInformation: { sessionDirection: p.dir, nniType: 'non-roaming', relationshipMode: 'non-trusted', neighbourNodeAddress: sbcHost(p.route) },
    routeRef: p.route,
  };
  if (p.rng.chance(0.5)) rec.originatingIoi = (NETS[rd.carrier] as { domain: string }).domain;
  return rec;
}

export const durBg = (rng: Rng): number => Math.min(900, Math.max(5, Math.round(15 + rng.exp(90))));
export const setupSecs = (rng: Rng): number => rng.int(2, 9);

// ---- Case generators ------------------------------------------------------------------------------

export interface Gen {
  L: 'A' | 'B' | 'C' | 'D';
  scscf: ScscfRecord[];
  ibcf: IbcfRecord[];
  layout: Layout | null;
  groupUris: string[];
  groupSubIds: string[];
  devices: string[];
  /** Records of the group of interest (originating) and records the group received (terminating). */
  gOrig: ScscfRecord[];
  gTerm: ScscfRecord[];
  bgOrig: ScscfRecord[];
  bgAll: ScscfRecord[];
  routes: Record<string, IbcfRecord[]>;
  routeBaselines: Record<string, number>;
  /** Case D: the burst records. */
  burst: ScscfRecord[];
  /** Case D: the trunk's own in-hours records to the same range. */
  rangeInHours: ScscfRecord[];
}

interface BgOpts {
  L: string;
  rng: Rng;
  count: number;
  meanOrig: number;
  meanIn: number;
  pInternal: number;
  sectors: Sec[];
  family: string;
}

function background(o: BgOpts, out: Sess[], exclude: Set<number>): Sim[] {
  const { rng, L } = o;
  const nums = simPool(rng, o.count + exclude.size + 60).filter((n) => !exclude.has(n)).slice(0, o.count);
  const sims = nums.map((n) => makeSim(L, n, rng.pick(o.sectors), o.family, rng));
  const legOf = (s: Sim): Leg => leg(s, rng.chance(0.55) ? (s.home as Sec) : rng.pick(o.sectors), pickLoc(rng));
  for (const s of sims) {
    const nOut = rng.poisson(o.meanOrig);
    for (let i = 0; i < nOut; i++) {
      const t = pickTime(rng, L, BG_HOURS);
      if (rng.chance(o.pInternal)) {
        const peer = rng.pick(sims.filter((x) => x !== s));
        out.push({ t, setup: setupSecs(rng), dur: rng.chance(0.03) ? null : durBg(rng), caller: s.uri, callee: peer.uri, orig: legOf(s), term: legOf(peer) });
      } else {
        out.push({ t, setup: setupSecs(rng), dur: rng.chance(0.03) ? null : durBg(rng), caller: s.uri, callee: peerUri('dom', L, rng.int(1, 900)), orig: legOf(s) });
      }
    }
    const nIn = rng.poisson(o.meanIn);
    for (let i = 0; i < nIn; i++) {
      out.push({ t: pickTime(rng, L, BG_HOURS), setup: setupSecs(rng), dur: rng.chance(0.03) ? null : durBg(rng), caller: peerUri('ext', L, rng.int(1, 900)), callee: s.uri, term: legOf(s) });
    }
  }
  return sims;
}

function inboundIntl(L: string, seed: number, rng: Rng, counts: Record<string, number>): { ibcf: IbcfRecord[]; routes: Record<string, IbcfRecord[]> } {
  const pending: { t: number; route: string }[] = [];
  for (const [route, n] of Object.entries(counts)) for (let i = 0; i < n; i++) pending.push({ t: pickTime(rng, L, BG_HOURS), route });
  pending.sort((a, b) => a.t - b.t || (a.route < b.route ? -1 : 1));
  const routes: Record<string, IbcfRecord[]> = {};
  const ibcf = pending.map((p, i) => {
    const rec = ibcfRecord(L, i + 1, {
      t: p.t,
      setup: setupSecs(rng),
      dur: durBg(rng),
      caller: intlCallerUri(p.route, rng.int(1, 900)),
      // Called parties are drawn from the wider network, not the cell extract in E1.
      callee: subUri(L, rng.int(9001, 9999)),
      dir: 'inbound',
      route: p.route,
      rng,
      seed,
    });
    (routes[p.route] ??= []).push(rec);
    return rec;
  });
  return { ibcf, routes };
}

interface GroupSpec {
  size: number;
  perSimLo: number;
  perSimHi: number;
  hours: readonly number[];
  leadShare: number;
  dur: (rng: Rng) => number;
  callees: (rng: Rng) => string;
  devices: number;
  family: string;
  /** Terminating sessions received by the group, per originating session. */
  inRatio: number;
  inCount?: number;
}

function finish(L: 'A' | 'B' | 'C', seed: number, bgOpts: Omit<BgOpts, 'rng' | 'L' | 'sectors'>, g: GroupSpec, routeCounts: Record<string, number>, routeBaselines: Record<string, number>): Gen {
  const rng = new Rng(subSeed(seed, `case-${L}`));
  const layout = makeLayout(L, rng);
  const sessions: Sess[] = [];
  const nums = simPool(rng, g.size);
  const gSims = nums.map((n) => makeSim(L, n, layout.lead, g.family, rng));
  // The group shares a few devices.
  const devs = Array.from({ length: g.devices }, () => equipToken(L, g.family, rng.int(1, 999999)));
  gSims.forEach((s, i) => (s.equip = devs[i % devs.length] as string));
  const gLeg = (s: Sim): Leg => leg(s, rng.chance(g.leadShare) ? layout.lead : layout.second, pickLoc(rng));
  for (const s of gSims) {
    const n = rng.int(g.perSimLo, g.perSimHi);
    for (let i = 0; i < n; i++) sessions.push({ t: pickTime(rng, L, g.hours), setup: setupSecs(rng), dur: rng.chance(0.03) ? null : g.dur(rng), caller: s.uri, callee: g.callees(rng), orig: gLeg(s) });
  }
  const nOrig = sessions.length;
  const nIn = g.inCount ?? Math.round(nOrig * g.inRatio);
  for (let i = 0; i < nIn; i++) {
    const s = rng.pick(gSims);
    sessions.push({ t: pickTime(rng, L, g.hours), setup: setupSecs(rng), dur: rng.chance(0.03) ? null : durBg(rng), caller: peerUri('ext', L, rng.int(1, 900)), callee: s.uri, term: gLeg(s) });
  }
  const exclude = new Set(nums);
  // Ordinary SIMs do not call the group's lead cell home: an alert grouping SIMs by cell then names the group itself.
  background({ ...bgOpts, rng, L, sectors: layout.sectors.filter((s) => s !== layout.lead) }, sessions, exclude);
  const { records, expanded } = expand(L, seed, sessions);
  void expanded;
  const { ibcf, routes } = inboundIntl(L, seed, new Rng(subSeed(seed, `ibcf-${L}`)), routeCounts);
  const gSet = new Set(gSims.map((s) => s.uri));
  const gOrig = records.filter((x) => x.roleOfNode === 'originating' && gSet.has(x.listOfCallingPartyAddress));
  const gTerm = records.filter((x) => x.roleOfNode === 'terminating' && gSet.has(x.calledPartyAddress));
  const bgAll = records.filter((x) => !(gSet.has(x.listOfCallingPartyAddress) && x.roleOfNode === 'originating') && !(gSet.has(x.calledPartyAddress) && x.roleOfNode === 'terminating'));
  return {
    L,
    scscf: records,
    ibcf,
    layout,
    groupUris: gSims.map((s) => s.uri),
    groupSubIds: gSims.map((s) => s.subId),
    devices: devs,
    gOrig,
    gTerm,
    bgOrig: bgAll.filter((x) => x.roleOfNode === 'originating'),
    bgAll,
    routes,
    routeBaselines,
    burst: [],
    rangeInHours: [],
  };
}

const [R1, R2, R3] = IN_ROUTES.map((x) => x.ref) as [string, string, string];

export function genA(seed: number): Gen {
  return finish(
    'A',
    seed,
    { count: 56, meanOrig: 8, meanIn: 5, pInternal: 0.55, family: 'F1' },
    {
      size: 8,
      perSimLo: 46,
      perSimHi: 54,
      hours: FLAT_HOURS,
      leadShare: 0.86,
      dur: (rng) => Math.min(400, Math.max(10, Math.round(20 + rng.exp(75)))),
      callees: (rng) => peerUri('dom', 'A', rng.int(1, 900)),
      devices: 2,
      family: 'F3',
      inRatio: 0,
      inCount: 2,
    },
    { [R1]: 255, [R2]: 214, [R3]: 52 },
    { [R1]: 260, [R2]: 210, [R3]: 240 },
  );
}

export function genB(seed: number): Gen {
  return finish(
    'B',
    seed,
    { count: 40, meanOrig: 4, meanIn: 3, pInternal: 0.55, family: 'F1' },
    {
      size: 50,
      perSimLo: 8,
      perSimHi: 13,
      hours: OFFICE_HOURS,
      leadShare: 0.95,
      dur: (rng) => Math.min(600, Math.max(30, Math.round(40 + rng.exp(150)))),
      callees: (rng) => peerUri('dom', 'B', rng.int(1, 900)),
      devices: 4,
      family: 'F4',
      inRatio: 0.8,
    },
    { [R1]: 262, [R2]: 204, [R3]: 226 },
    { [R1]: 260, [R2]: 210, [R3]: 240 },
  );
}

export function genC(seed: number): Gen {
  const callSet = [11, 212, 347, 509, 731];
  return finish(
    'C',
    seed,
    { count: 40, meanOrig: 6, meanIn: 4, pInternal: 0.55, family: 'F1' },
    {
      size: 24,
      perSimLo: 22,
      perSimHi: 28,
      hours: UNIFORM_HOURS,
      leadShare: 0.88,
      dur: (rng) => rng.int(20, 31),
      callees: (rng) => peerUri('dom', 'C', rng.pick(callSet)),
      devices: 3,
      family: 'F2',
      inRatio: 0,
      inCount: 12,
    },
    { [R1]: 258, [R2]: 216, [R3]: 243 },
    { [R1]: 260, [R2]: 210, [R3]: 240 },
  );
}

export function genD(seed: number): Gen {
  const L = 'D';
  const rng = new Rng(subSeed(seed, 'case-D'));
  const sessions: Sess[] = [];
  const trunkLeg = (n: number): Leg => ({ uri: trunkUri(n), subId: trunkSubId(n), sec: null, loc: null });
  const dest = (prefix: string): string => destUri(prefix, rng.int(1, 9999));
  const stdRange = (): string => STD_BLOCK_PREFIXES[rng.int(1, 5) - 1] as string;
  for (let n = 1; n <= 6; n++) {
    const count = n === 3 ? 44 : rng.poisson(95);
    for (let i = 0; i < count; i++) {
      sessions.push({ t: pickTime(rng, L, OFFICE_HOURS), setup: setupSecs(rng), dur: rng.chance(0.03) ? null : Math.round(30 + rng.exp(120)), caller: trunkUri(n), callee: dest(stdRange()), orig: trunkLeg(n) });
    }
  }
  // The target trunk's own history to the range: a few sessions, inside business hours.
  const inHoursStart = sessions.length;
  for (let i = 0; i < 4; i++) {
    const day = rng.int(0, 2);
    const t = startMs(L) + ((day * 24 + rng.int(9, 15)) * 3600 + rng.int(0, 3599)) * 1000;
    sessions.push({ t, setup: setupSecs(rng), dur: Math.round(30 + rng.exp(90)), caller: trunkUri(3), callee: dest(PREMIUM_BLOCK), orig: trunkLeg(3) });
  }
  const inHoursEnd = sessions.length;
  // The burst: one night, 19:20 on day 2 to 03:50 on day 3.
  const burstStart = sessions.length;
  const from = startMs(L) + (24 * 3600 + 19 * 3600 + 20 * 60) * 1000;
  const span = (8 * 3600 + 30 * 60) * 1000;
  for (let i = 0; i < 148; i++) {
    sessions.push({ t: from + Math.floor(rng.next() * span), setup: setupSecs(rng), dur: rng.chance(0.02) ? null : rng.int(40, 180), caller: trunkUri(3), callee: dest(PREMIUM_BLOCK), orig: trunkLeg(3) });
  }
  const burstEnd = sessions.length;
  const { records, expanded } = expand(L, seed, sessions);
  const byIdx = new Map(sessions.map((s, i) => [s, i] as const));
  const inSet = (lo: number, hi: number) => expanded.filter((e) => { const i = byIdx.get(e.sess) as number; return i >= lo && i < hi; });
  const burst = inSet(burstStart, burstEnd).map((e) => e.orig as ScscfRecord);
  const rangeInHours = inSet(inHoursStart, inHoursEnd).map((e) => e.orig as ScscfRecord);
  // Outbound interconnect view of the burst calls: a second view of the same event, not an independent source.
  const ibcfRng = new Rng(subSeed(seed, 'ibcf-D'));
  const ibcf = inSet(burstStart, burstEnd)
    .sort((a, b) => a.sess.t - b.sess.t)
    .map((e, i) =>
      ibcfRecord(L, i + 1, {
        t: e.sess.t,
        setup: e.sess.setup,
        dur: e.sess.dur ?? 0,
        caller: e.sess.caller,
        callee: e.sess.callee,
        dir: 'outbound',
        route: OUT_ROUTE.ref,
        sessionId: e.sessionId,
        icid: e.icid,
        rng: ibcfRng,
        seed,
      }),
    );
  const t3 = trunkUri(3);
  const gOrig = records.filter((x) => x.listOfCallingPartyAddress === t3);
  return {
    L,
    scscf: records,
    ibcf,
    layout: null,
    groupUris: [t3],
    groupSubIds: [trunkSubId(3)],
    devices: [],
    gOrig,
    gTerm: [],
    bgOrig: records.filter((x) => x.listOfCallingPartyAddress !== t3),
    bgAll: records.filter((x) => x.listOfCallingPartyAddress !== t3),
    routes: { [OUT_ROUTE.ref]: ibcf },
    routeBaselines: {},
    burst,
    rangeInHours,
  };
}
