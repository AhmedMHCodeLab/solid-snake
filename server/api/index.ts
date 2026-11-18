// The platform API as a factory. Handlers are plain functions over ApiRequest and ApiResponse; one route table lists them.
// Workspace state is folded from the workspace's hash-chained audit log. Every sign-off, order and referral rule lives here.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Alert, AnyRecord, AuditEvent, CaseFile, CaseId, CaseRow, CaseStatus, CollectionRequest, ConnectorInfo, DemoUser, Level,
  Point, Role, SendRow, SignAction, SignRow, SourceCode, StepTrigger,
} from '../../shared/types';
import { LEVEL_NAMES } from '../../shared/types';
import { bindScenario, scenarioEvidence } from '../engine/bind';
import { DETECTION_RULES, baselineRecords, detect } from '../engine/detect';
import type { EngineDetection } from '../engine/detect';
import { CASE_IDS, cellRegions, loadCases, loadFeed } from '../engine/feed';
import type { Feed } from '../engine/feed';
import { levelMap } from '../engine/assess';
import { assessView, recordsOf, release, releasedRecordIds } from '../engine/release';
import type { ReleasedView } from '../engine/release';
import { actionLabelOf, lastIndex, signoffIndex, triggerOf } from '../engine/workflow';
import { Refusal, browserId, html, json, parseBody, readBody, refusalResponse } from './http';
import type { ApiRequest, ApiResponse, Handler, Route } from './http';
import { buildPacket } from './packet';
import type { Signer } from './packet';
import { ChainBroken, createStore } from './store';
import type { NewEvent } from './store';

export type { ApiRequest, ApiResponse, Handler, Route } from './http';

export interface ApiOptions {
  dataDir: string;
  runtimeDir: string;
  /** HMAC secret for the audit log. Supplied by the deployment (see auditKeyFrom); never stored beside the log. */
  auditKey: string;
  now: () => Date;
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'analyst-1', displayName: 'Analyst 1', role: 'analyst', basis: 'FICTION' },
  { id: 'analyst-2', displayName: 'Analyst 2', role: 'analyst', basis: 'FICTION' },
  { id: 'supervisor-1', displayName: 'Supervisor 1', role: 'supervisor', basis: 'FICTION' },
];

/** Prepared reasons for dismissing an alert. There is no free text anywhere. */
export const DISMISS_REASONS = [
  { code: 'DIS-KNOWN-ACTIVITY', label: 'Explained by activity already on record as legitimate.' },
  { code: 'DIS-NORMAL-VARIATION', label: 'Within normal variation once the population is read in full.' },
  { code: 'DIS-DATA-QUALITY', label: 'Caused by a gap or fault in the records, not by traffic.' },
  { code: 'DIS-DUPLICATE', label: 'Duplicates an alert already being worked.' },
] as const;

/** The contract's FeedStatus; shared/types.ts does not define it yet. */
export interface FeedStatus {
  state: 'idle' | 'running' | 'paused' | 'done';
  window: { start: string; end: string };
  cursor: string;
  ingested: number;
  total: number;
  buckets: { start: string; count: number }[];
  byRegion: { shapeId: string; count: number }[];
}

/** What the API serves for an alert. The demo binding to a scenario stays on the server: nothing here names it. */
export type PlatformAlert = Omit<Alert, 'scenario' | 'detection' | 'caseRef'> & {
  detection: EngineDetection;
  caseRef?: string;
  /** Set when another alert on the same bound evidence already has a case in this workspace: the case to work instead. */
  relatedCaseRef?: string;
  /** The national-plate region, [lon, lat], opaque id. Already released at case step 0, so serving it here leaks nothing. */
  region: { shapeId: string; label: string; points: Point[] } | null;
};
/** An alert with its demo connector binding. Never leaves the server. */
type BoundAlert = PlatformAlert & { scenario: CaseId | null };

/** The contract's CaseStatus plus one: a case with nothing at level 5 is ready for an assessment record, not a sign-off. */
export type PlatformCaseStatus = CaseStatus | 'awaiting-assessment';
/** A case row as served: the scenario binding is not part of it. */
export type PlatformCaseRow = Omit<CaseRow, 'scenario' | 'status'> & { status: PlatformCaseStatus };
/** A sign-off row as served: no case letter. */
export type PlatformSignRow = Omit<SignRow, 'caseId'>;
/** A send-log row as served: no case letter. */
export type PlatformSendRow = Omit<SendRow, 'caseId'>;
/** The released case as served: id and code are the case reference, never the scenario's letter or code. */
export type PlatformView = Omit<ReleasedView, 'id' | 'code'> & { id: string; code: string };
/** Levels recomputed by the platform at every released step: step, then entry id. */
export type LevelHistory = Record<string, Record<string, Level | null>>;
type Collection = CollectionRequest & { kind: 'collect' | 'test' };

const ID = /^[A-Za-z0-9-]{1,40}$/;
const CODE = /^[A-Z0-9-]{1,40}$/;
const NUM = /^\d{1,6}$/;
const REF = /^TFIU-\d{4}-\d{4}$/;
const ALERT = /^ALR-\d{4}$/;
const SOURCE = /^E[1-7]$/;
const DELIVERED = 'delivered (simulated)';
const QUARTER = 15 * 60_000;
const REPLAY_SECONDS = 180;

// ---- The loaded platform: scenarios, feed and detections, computed once per data directory ----------------------

interface Platform {
  cases: Record<CaseId, CaseFile>;
  feed: Feed;
  start: number;
  end: number;
  defaultSpeed: number;
  alerts: BoundAlert[];
  regionOf: (string | null)[];
  connectors: ConnectorInfo[];
}

const platforms = new Map<string, Platform>();

function severity(d: EngineDetection): Alert['severity'] {
  const f = d.position === 'below' ? d.baseline.value / Math.max(1e-9, d.value * d.baseline.value) : d.value / Math.max(1e-9, d.baseline.value);
  return f >= 5 ? 'Immediate' : f >= 3 ? 'Priority' : 'Routine';
}

function alertTitle(d: EngineDetection): string {
  if (d.ruleId === 'DR-1') return `Unusual outbound calling from a group of ${d.subject.plainName.split(' ')[0]} SIMs on one cell`;
  if (d.ruleId === 'DR-2') return `Inbound international traffic on route ${d.subject.ref} well below its own history`;
  return `Out-of-hours burst of calls from one line to number block ${d.subject.ref.split('|')[1]}`;
}

function loadPlatform(dataDir: string): Platform {
  const hit = platforms.get(dataDir);
  if (hit) return hit;
  const cases = loadCases(dataDir);
  const feed = loadFeed(dataDir, cases);
  const evidence = scenarioEvidence(cases);
  const regions = cellRegions(cases);
  const cellOfRec = (x: AnyRecord): string | undefined => (x.recordType === 'sCSCFRecord' ? (x.userLocationInfo?.cellRef ?? x.accessNetworkInformation?.cellRef) : undefined);
  const byId = new Map(feed.records.map((x) => [x.id, x]));
  const alerts = detect(feed).map((d): BoundAlert => {
    const cell = d.recordIds.map((id) => byId.get(id)).map((x) => (x ? cellOfRec(x) : undefined)).find((c) => c && regions.has(c));
    const scenario = bindScenario(d, evidence);
    const regionShapeId = cell ? (regions.get(cell) as string) : null;
    const shape = scenario ? cases[scenario].map.shapes.find((x) => x.id === regionShapeId && x.kind === 'region' && x.plate === 'national') : undefined;
    return { simulated: true, id: `ALR-${d.id.slice(4)}`, detection: d, title: alertTitle(d), severity: severity(d), regionShapeId, status: 'new', scenario, region: shape ? { shapeId: shape.id, label: shape.label, points: shape.points } : null };
  });
  const start = Date.parse(feed.window.start);
  const end = Date.parse(feed.window.end);
  const connectorsFile = join(dataDir, 'connectors.json');
  const connectors: ConnectorInfo[] = existsSync(connectorsFile)
    ? (JSON.parse(readFileSync(connectorsFile, 'utf8')) as ConnectorInfo[])
    : cases.a.sources.map((s) => ({ source: s.code, plainName: s.plainName ?? s.name, mode: 'demo-synthetic' as const, turnaroundMinutes: 60 }));
  const p: Platform = {
    cases,
    feed,
    start,
    end,
    defaultSpeed: Math.round(((end - start) / 60_000 / REPLAY_SECONDS) * 100) / 100,
    alerts,
    regionOf: feed.records.map((x) => { const c = cellOfRec(x); return c ? (regions.get(c) ?? null) : null; }),
    connectors,
  };
  platforms.set(dataDir, p);
  return p;
}

// ---- Workspace state, folded from the audit log -------------------------------------------------------------------

interface SignEvt { seq: number; at: string; actor: string; entryId: string; kind: SignRow['kind']; action: SignAction; reasonCode: string }
interface CounterEvt { seq: number; at: string; actor: string; entryId: string; result: 'sign' | 'return'; checks: { id: string; passed: boolean }[]; analyst: string }
interface CaseState {
  ref: string;
  alertId: string;
  scenario: CaseId;
  openedAt: string;
  openedBy: string;
  step: number;
  collections: Collection[];
  signs: SignEvt[];
  counters: CounterEvt[];
  referral: { at: string; actor: string; entryId: string; recipients: string[] } | null;
  closed: boolean;
}
interface WsState {
  feed: { state: 'idle' | 'running' | 'paused'; speed: number; since: number; accMs: number };
  alerts: Map<string, { status: Alert['status']; caseRef?: string; dismissReasonCode?: string }>;
  cases: Map<string, CaseState>;
  opened: number;
}

const str = (d: Record<string, string | number>, k: string): string => String(d[k] ?? '');

function fold(events: AuditEvent[], scenarioOf: (alertId: string) => CaseId | null): WsState {
  const fresh = (opened: number): WsState => ({ feed: { state: 'idle', speed: 0, since: 0, accMs: 0 }, alerts: new Map(), cases: new Map(), opened });
  let s = fresh(0);
  for (const e of events) {
    const d = e.detail;
    const c = e.caseRef ? s.cases.get(e.caseRef) : undefined;
    switch (e.action) {
      case 'reset':
        s = fresh(s.opened);
        break;
      case 'feed-start':
        s.feed = { ...s.feed, state: 'running', speed: Number(d.speed), since: Date.parse(e.at) };
        break;
      case 'feed-pause':
        s.feed = { ...s.feed, state: 'paused', accMs: s.feed.accMs + (Date.parse(e.at) - s.feed.since) * s.feed.speed * 60 };
        break;
      case 'feed-speed':
        s.feed = { ...s.feed, speed: Number(d.speed), since: Date.parse(e.at), accMs: s.feed.accMs + (Date.parse(e.at) - s.feed.since) * s.feed.speed * 60 };
        break;
      case 'alert-dismiss':
        s.alerts.set(str(d, 'alertId'), { status: 'dismissed', dismissReasonCode: str(d, 'reasonCode') });
        break;
      case 'alert-open': {
        // The scenario is never written to the log: it is looked up from the alert, on the server.
        const scenario = scenarioOf(str(d, 'alertId'));
        if (!scenario) break;
        s.opened++;
        s.alerts.set(str(d, 'alertId'), { status: 'case-opened', caseRef: e.caseRef as string });
        s.cases.set(e.caseRef as string, { ref: e.caseRef as string, alertId: str(d, 'alertId'), scenario, openedAt: e.at, openedBy: e.actor, step: -1, collections: [], signs: [], counters: [], referral: null, closed: false });
        break;
      }
      case 'step-released':
        if (c) c.step = Math.max(c.step, Number(d.step));
        break;
      case 'collection-request':
        c?.collections.push({ id: str(d, 'requestId'), caseRef: c.ref, source: str(d, 'source') as SourceCode, requestedAt: e.at, requestedBy: e.actor, dueAt: str(d, 'dueAt'), status: 'requested', kind: str(d, 'kind') as 'collect' | 'test' });
        break;
      case 'collection-return': {
        const r = c?.collections.find((x) => x.id === str(d, 'requestId'));
        if (r) Object.assign(r, { status: str(d, 'status'), returnedAt: e.at });
        break;
      }
      case 'sign':
      case 'assessment-recorded':
        c?.signs.push({ seq: e.seq, at: e.at, actor: e.actor, entryId: str(d, 'entryId'), kind: str(d, 'kind') as SignRow['kind'], action: str(d, 'action') as SignAction, reasonCode: str(d, 'reasonCode') });
        break;
      case 'countersign':
        c?.counters.push({ seq: e.seq, at: e.at, actor: e.actor, entryId: str(d, 'entryId'), result: str(d, 'result') as 'sign' | 'return', analyst: str(d, 'analyst'), checks: str(d, 'checks').split(',').filter(Boolean).map((x) => ({ id: x.split(':')[0] as string, passed: x.split(':')[1] === 'passed' })) });
        break;
      case 'referral':
        if (c) c.referral = { at: e.at, actor: e.actor, entryId: str(d, 'entryId'), recipients: str(d, 'recipients').split(',') };
        break;
      case 'case-closed':
        if (c) c.closed = true;
        break;
    }
  }
  return s;
}

// ---- The API ------------------------------------------------------------------------------------------------------

export function createApi(opts: ApiOptions) {
  const store = createStore(opts.runtimeDir, opts.auditKey);
  const P = () => loadPlatform(opts.dataDir);
  const nowIso = () => opts.now().toISOString();

  // The case files never change, so what is released at a step (and the levels recomputed from it) is computed once.
  const views = new Map<string, ReleasedView>();
  const levelCache = new Map<string, Map<string, Level | null>>();
  const releaseAt = (sc: CaseId, step: number, sealed = true): ReleasedView => {
    const k = `${sc}:${step}:${sealed}`;
    let v = views.get(k);
    if (!v) views.set(k, (v = release(P().cases[sc], step, { sealed })));
    return v;
  };
  const levelsOf = (sc: CaseId, step: number): Map<string, Level | null> => {
    if (step < 0) return new Map();
    const k = `${sc}:${step}`;
    let m = levelCache.get(k);
    if (!m) levelCache.set(k, (m = levelMap(assessView(P().cases[sc], releaseAt(sc, step)))));
    return m;
  };

  const wsIdOf = (bid: string) => `ws-${createHash('sha256').update(bid).digest('hex').slice(0, 16)}`;

  function userOf(req: ApiRequest): DemoUser | null {
    const id = req.headers['x-demo-user'];
    if (id === undefined || id === '') return null;
    const u = DEMO_USERS.find((x) => x.id === id);
    if (!u) throw new Refusal(401, 'unknown-user', 'The x-demo-user header does not name a demo account.');
    return u;
  }
  function needUser(req: ApiRequest, roles: Role[]): DemoUser {
    const u = userOf(req);
    if (!u) throw new Refusal(401, 'sign-in-required', 'Sign in as a demo account first (x-demo-user header).');
    if (!roles.includes(u.role)) throw new Refusal(403, 'wrong-role', `This action needs the ${roles.join(' or ')} role.`);
    return u;
  }

  /** One request's view of a workspace: due collections are settled first, then state is folded. */
  function workspace(req: ApiRequest, forWrite = false) {
    const id = wsIdOf(browserId(req));
    // Verified once per request. State is folded only from the verified prefix; writes are refused while any check fails.
    const loaded = store.load(id);
    if (forWrite && !loaded.verdict.ok) throw new ChainBroken(loaded.verdict);
    let events = loaded.events;
    const write = (evs: NewEvent[]) => {
      const out = store.append(id, evs);
      events = events.concat(out);
      return out;
    };
    const ev = (actor: string, role: Role | 'system', action: string, detail: Record<string, string | number> = {}, caseRef?: string): NewEvent => ({ at: nowIso(), workspaceId: id, actor, role, action, ...(caseRef ? { caseRef } : {}), detail });
    const state = () => fold(events, (alertId) => P().alerts.find((a) => a.id === alertId)?.scenario ?? null);

    /** Releases steps up to target, then every 'auto' or 'close' step after it, writing step and level events. */
    function releaseTo(c: CaseState, target: number, actor: string, role: Role | 'system') {
      const file = P().cases[c.scenario];
      const before = levelsOf(c.scenario, c.step);
      const out: NewEvent[] = [];
      let step = c.step;
      const rel = (i: number) => out.push(ev(actor, role, 'step-released', { step: i, stage: (file.steps[i] as { stage: number }).stage, trigger: triggerOf(file, i).kind }, c.ref));
      for (let i = step + 1; i <= target; i++) rel(i);
      step = Math.max(step, target);
      while (step + 1 <= lastIndex(file) && ['auto', 'close'].includes(triggerOf(file, step + 1).kind)) rel(++step);
      const after = levelsOf(c.scenario, step);
      for (const [entryId, to] of after) {
        const from = before.get(entryId) ?? null;
        if (from !== to) out.push(ev(actor, role, 'level-change', { entryId, from: from ?? 'none', to: to ?? 'none', step }, c.ref));
      }
      write(out);
      c.step = step;
    }

    /** Does the released step bring evidence from this source? Decides 'returned' or 'not-returned'. */
    function brings(file: CaseFile, index: number, source: SourceCode): boolean {
      const step = file.steps[index];
      if (!step) return false;
      const recs = recordsOf(file);
      const ofId = (id: string) => file.evidenceItems.find((x) => x.id === id)?.source ?? file.indicators.find((x) => x.id === id)?.source ?? (recs.has(id) ? (recs.get(id)?.recordType === 'iBCFRecord' ? 'E2' : 'E1') : undefined);
      const ids = [
        ...step.exhibits.filter((e) => e.kind === 'evidence' || e.kind === 'indicator' || e.kind === 'records').map((e) => e.refId),
        ...[...file.claims, ...file.hypotheses].flatMap((e) => (e.versions as { step: number; evidenceIds: string[] }[]).filter((v) => v.step === index).flatMap((v) => v.evidenceIds)),
      ];
      return ids.some((id) => ofId(id) === source);
    }

    function settle() {
      const nowMs = opts.now().getTime();
      for (const c of state().cases.values()) {
        for (const r of c.collections) {
          if (r.status !== 'requested' || Date.parse(r.dueAt) > nowMs) continue;
          const file = P().cases[c.scenario];
          write([ev(`connector-${r.source}`, 'system', 'collection-return', { requestId: r.id, source: r.source, status: brings(file, c.step + 1, r.source) ? 'returned' : 'not-returned' }, c.ref)]);
          releaseTo(c, c.step + 1, `connector-${r.source}`, 'system');
        }
      }
    }
    if (loaded.verdict.ok) settle();
    return { id, write, ev, state, releaseTo, chain: loaded.verdict };
  }
  type Ws = ReturnType<typeof workspace>;

  // ---- Feed ------------------------------------------------------------------------------------------------------

  function cursorOf(s: WsState): number {
    const p = P();
    const running = s.feed.state === 'running' ? (opts.now().getTime() - s.feed.since) * s.feed.speed * 60 : 0;
    return Math.min(p.end, p.start + s.feed.accMs + running);
  }

  function feedStatus(s: WsState): FeedStatus {
    const p = P();
    const cursor = cursorOf(s);
    let ingested = 0;
    let hi = p.feed.times.length;
    while (ingested < hi) {
      const mid = (ingested + hi) >> 1;
      if ((p.feed.times[mid] as number) <= cursor) ingested = mid + 1;
      else hi = mid;
    }
    const buckets: { start: string; count: number }[] = [];
    if (s.feed.state !== 'idle') {
      const n = Math.min(Math.floor((cursor - p.start) / QUARTER) + 1, Math.ceil((p.end - p.start) / QUARTER));
      const counts = new Array<number>(n).fill(0);
      for (let i = 0; i < ingested; i++) counts[Math.floor(((p.feed.times[i] as number) - p.start) / QUARTER)]! += 1;
      counts.forEach((count, i) => buckets.push({ start: new Date(p.start + i * QUARTER).toISOString().slice(0, 19) + 'Z', count }));
    }
    const regions = new Map<string, number>();
    for (let i = 0; i < ingested; i++) {
      const r = p.regionOf[i];
      if (r) regions.set(r, (regions.get(r) ?? 0) + 1);
    }
    return {
      state: s.feed.state !== 'idle' && cursor >= p.end ? 'done' : s.feed.state,
      window: p.feed.window,
      cursor: new Date(cursor).toISOString().slice(0, 19) + 'Z',
      ingested,
      total: p.feed.records.length,
      buckets,
      byRegion: [...regions].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([shapeId, count]) => ({ shapeId, count })),
    };
  }

  /** Alerts raised so far, without the demo binding. A second alert on evidence that already has a case points at that case. */
  function alertsOf(s: WsState): PlatformAlert[] {
    const cursor = cursorOf(s);
    const p = P();
    return p.alerts
      .filter((a) => (s.feed.state === 'idle' ? false : Date.parse(a.detection.at) <= cursor))
      .map(({ scenario, ...a }) => {
        const state = s.alerts.get(a.id);
        const related = scenario && !state?.caseRef ? [...s.cases.values()].find((c) => c.scenario === scenario)?.ref : undefined;
        return { ...a, ...(state ?? {}), ...(related ? { relatedCaseRef: related } : {}) };
      });
  }
  /** The case already open on the same bound evidence, if any: refused as a duplicate. */
  const sameEvidenceCase = (s: WsState, alertId: string): string | undefined => {
    const scenario = P().alerts.find((a) => a.id === alertId)?.scenario;
    return scenario ? [...s.cases.values()].find((c) => c.scenario === scenario)?.ref : undefined;
  };

  // ---- Cases -----------------------------------------------------------------------------------------------------

  function caseOf(ws: Ws, ref: string): { c: CaseState; s: WsState; file: CaseFile } {
    if (!REF.test(ref)) throw new Refusal(404, 'unknown-case', 'There is no such case in this workspace.');
    const s = ws.state();
    const c = s.cases.get(ref);
    if (!c) throw new Refusal(404, 'unknown-case', 'There is no such case in this workspace.');
    return { c, s, file: P().cases[c.scenario] };
  }

  /**
   * The current analyst promote on an entry and the latest countersign written after it, if any. Ordered by audit seq.
   * A supervisor's return cancels the promotion it returns: the analyst is then null, and the case needs a new
   * analyst promote (a higher seq) before any countersign can count.
   */
  function signatures(c: CaseState, entryId: string) {
    const a = [...c.signs].reverse().find((x) => x.entryId === entryId);
    if (a?.action !== 'promote') return { analyst: null, supervisor: null };
    const s = [...c.counters].reverse().find((x) => x.entryId === entryId && x.seq > a.seq) ?? null;
    if (s?.result === 'return') return { analyst: null, supervisor: s };
    return { analyst: a, supervisor: s };
  }

  /** Is the current analyst signature on the signable entry countersigned? Only then is the seal released. */
  const sealedOf = (c: CaseState, view: ReleasedView): boolean => {
    const e = view.signoff.signableEntryId;
    if (!e) return false;
    const { analyst, supervisor } = signatures(c, e);
    return !!analyst && supervisor?.result === 'sign';
  };
  /** The case as released to its current step, with the seal only once countersigned. */
  const viewOf = (c: CaseState): ReleasedView => releaseAt(c.scenario, c.step, sealedOf(c, releaseAt(c.scenario, c.step)));

  function statusOf(c: CaseState, file: CaseFile, view: ReleasedView): PlatformCaseStatus {
    if (c.referral) return 'referred';
    if (c.closed) return 'closed-assessment';
    const pend = c.collections.find((x) => x.status === 'requested');
    if (pend) return pend.kind === 'test' ? 'awaiting-test' : 'awaiting-collection';
    if (c.step < signoffIndex(file) - 1) return 'open';
    const e = view.signoff.signableEntryId;
    if (e) {
      const { analyst, supervisor } = signatures(c, e);
      if (analyst && !supervisor) return 'awaiting-supervisor';
      if (analyst && supervisor?.result === 'sign') return 'open';
      return 'awaiting-sign-off';
    }
    // Nothing is at level 5: there is no sign-off to give, only an assessment record.
    return 'awaiting-assessment';
  }

  function rowOf(ws: Ws, c: CaseState): PlatformCaseRow {
    const file = P().cases[c.scenario];
    const view = releaseAt(c.scenario, c.step);
    return {
      simulated: true,
      ref: c.ref,
      workspaceId: ws.id,
      alertId: c.alertId,
      openedAt: c.openedAt,
      openedBy: c.openedBy,
      assignee: c.openedBy,
      step: c.step,
      status: statusOf(c, file, view),
      collections: c.collections.map(({ kind: _k, ...r }) => (void _k, r)),
    };
  }

  function nextOf(c: CaseState, file: CaseFile): { trigger: StepTrigger; actionLabel: string } | null {
    if (c.closed || c.referral || c.step + 1 > lastIndex(file)) return null;
    return { trigger: triggerOf(file, c.step + 1), actionLabel: actionLabelOf(file, c.step + 1) };
  }

  const lacks = (file: CaseFile, view: ReleasedView, entryId: string, level: Level | null): string =>
    view.signoff.openEntries.find((o) => o.entryId === entryId)?.lacks ?? file.signoff.openEntries.find((o) => o.entryId === entryId)?.lacks ?? (level === null ? 'An explanation that still holds on the evidence: it fell.' : 'A result from outside the analytic chain.');

  // ---- Handlers: session and feed ----------------------------------------------------------------------------------

  const getSession: Handler = (req) => {
    const ws = workspace(req);
    return json(200, { users: DEMO_USERS, workspace: { id: ws.id, feed: feedStatus(ws.state()), audit: { ok: ws.chain.ok } }, connectors: P().connectors, dismissReasons: DISMISS_REASONS, detectionRules: DETECTION_RULES });
  };

  const getFeed: Handler = (req) => json(200, feedStatus(workspace(req).state()));

  const ANY_ROLE: Role[] = ['analyst', 'supervisor', 'unit-lead'];
  const postFeedStart: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ANY_ROLE);
    const body = parseBody(req, ['speed'], true);
    let speed = P().defaultSpeed;
    if ('speed' in body) {
      if (typeof body.speed !== 'number' || !Number.isFinite(body.speed) || body.speed < 1 || body.speed > 100_000) throw new Refusal(400, 'bad-value', 'speed is feed minutes per wall second, a number from 1 to 100000.');
      speed = body.speed;
    }
    const s = ws.state();
    const st = feedStatus(s);
    if (st.state === 'done') throw new Refusal(409, 'feed-done', 'The feed has replayed in full. Reset the workspace to replay it.');
    if (s.feed.state !== 'running') ws.write([ws.ev(u.id, u.role, 'feed-start', { speed })]);
    else if ('speed' in body && speed !== s.feed.speed) ws.write([ws.ev(u.id, u.role, 'feed-speed', { speed, from: s.feed.speed })]);
    return json(200, feedStatus(ws.state()));
  };

  const postFeedPause: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ANY_ROLE);
    parseBody(req, [], true);
    if (ws.state().feed.state === 'running') ws.write([ws.ev(u.id, u.role, 'feed-pause', { cursor: feedStatus(ws.state()).cursor })]);
    return json(200, feedStatus(ws.state()));
  };

  const postReset: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ANY_ROLE);
    parseBody(req, [], true);
    ws.write([ws.ev(u.id, u.role, 'reset')]);
    return json(200, { workspace: { id: ws.id, feed: feedStatus(ws.state()) } });
  };

  // ---- Handlers: alerts --------------------------------------------------------------------------------------------

  function visibleAlert(ws: Ws, id: string): PlatformAlert {
    if (!ALERT.test(id)) throw new Refusal(404, 'unknown-alert', 'There is no such alert in the queue.');
    const a = alertsOf(ws.state()).find((x) => x.id === id);
    if (!a) throw new Refusal(404, 'unknown-alert', 'There is no such alert in the queue.');
    return a;
  }

  const getAlerts: Handler = (req) => json(200, alertsOf(workspace(req).state()));

  /** The records an alert's baseline was computed from, paged, with their count and digest so the baseline can be recomputed. */
  const getBaseline: Handler = (req) => {
    const ws = workspace(req);
    const a = visibleAlert(ws, req.params.id ?? '');
    const num = (name: string, dflt: number, max: number): number => {
      const raw = req.query.get(name);
      if (raw === null) return dflt;
      const n = NUM.test(raw) ? Number(raw) : NaN;
      if (!(n >= 0 && n <= max)) throw new Refusal(400, 'bad-query', 'A query value is outside the allowed range.');
      return n;
    };
    const offset = num('offset', 0, 1_000_000);
    const limit = Math.max(1, num('limit', 100, 500));
    const pop = baselineRecords(a.detection, P().feed);
    return json(200, { alertId: a.id, ruleId: a.detection.ruleId, window: a.detection.window, population: a.detection.baselinePopulation, baselineValue: a.detection.baseline.value, offset, limit, recordIds: pop.slice(offset, offset + limit).map((x) => x.id) });
  };

  const postDismiss: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ['analyst']);
    const body = readBody(req, { reasonCode: DISMISS_REASONS.map((r) => r.code) });
    const a = visibleAlert(ws, req.params.id ?? '');
    if (a.status !== 'new') throw new Refusal(409, 'alert-not-new', 'This alert has already been dismissed or opened as a case.');
    ws.write([ws.ev(u.id, u.role, 'alert-dismiss', { alertId: a.id, reasonCode: body.reasonCode as string })]);
    return json(200, visibleAlert(ws, a.id));
  };

  const postOpen: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ['analyst']);
    parseBody(req, [], true);
    const a = visibleAlert(ws, req.params.id ?? '');
    if (a.status !== 'new') throw new Refusal(409, 'alert-not-new', 'This alert has already been dismissed or opened as a case. One case per alert.');
    const bound = P().alerts.find((x) => x.id === a.id)?.scenario;
    if (!bound) throw new Refusal(409, 'no-connector-data', 'No source connector holds evidence for this alert in the demo. It can only be dismissed with a prepared reason.');
    const s = ws.state();
    const dup = sameEvidenceCase(s, a.id);
    if (dup) throw new Refusal(409, 'same-evidence-case-open', `Case ${dup} is already open on the same evidence. Work it there, or dismiss this alert as a duplicate.`);
    const ref = `TFIU-${a.detection.at.slice(0, 4)}-${String(s.opened + 1).padStart(4, '0')}`;
    ws.write([ws.ev(u.id, u.role, 'alert-open', { alertId: a.id, ruleId: a.detection.ruleId }, ref)]);
    const c = ws.state().cases.get(ref) as CaseState;
    ws.releaseTo(c, 0, u.id, u.role);
    return json(201, rowOf(ws, ws.state().cases.get(ref) as CaseState));
  };

  // ---- Handlers: cases ---------------------------------------------------------------------------------------------

  const listCases: Handler = (req) => {
    const ws = workspace(req);
    return json(200, [...ws.state().cases.values()].map((c) => rowOf(ws, c)));
  };

  const getCase: Handler = (req) => {
    const ws = workspace(req);
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    const view = viewOf(c);
    const levels = assessView(file, releaseAt(c.scenario, c.step));
    const row = rowOf(ws, c);
    // Every level the page shows comes from here: the current levels, and the levels recomputed at each released step.
    const history: LevelHistory = {};
    for (let i = 0; i <= c.step; i++) history[i] = Object.fromEntries(levelsOf(c.scenario, i));
    const e = releaseAt(c.scenario, c.step).signoff.signableEntryId;
    const sg = e ? signatures(c, e) : null;
    const served: PlatformView = { ...view, id: c.ref, code: c.ref };
    return json(200, {
      case: row,
      view: served,
      levels: levels.map((l) => ({ ...l, levelName: l.level === null ? 'No level' : LEVEL_NAMES[l.level] })),
      levelHistory: history,
      signedBy: sg?.analyst?.actor ?? null,
      next: nextOf(c, file),
      pending: row.collections.filter((x) => x.status === 'requested'),
    });
  };

  const getRecords: Handler = (req) => {
    const ws = workspace(req);
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    const view = releaseAt(c.scenario, c.step);
    const released = releasedRecordIds(file, view);
    const records = recordsOf(file);
    const q = req.query;
    const num = (name: string, dflt: number, min: number, max: number): number => {
      const raw = q.get(name);
      if (raw === null) return dflt;
      const n = NUM.test(raw) ? Number(raw) : NaN;
      if (!(n >= min && n <= max)) throw new Refusal(400, 'bad-query', 'A query value is outside the allowed range.');
      return n;
    };
    const ids = q.get('ids');
    const entryId = q.get('entry');
    if ((ids === null) === (entryId === null)) throw new Refusal(400, 'bad-query', 'Give exactly one of ids or entry.');

    if (ids !== null) {
      const list = ids.split(',');
      if (list.length > 100) throw new Refusal(400, 'too-many-ids', 'At most 100 ids per request.');
      if (list.some((i) => !ID.test(i))) throw new Refusal(400, 'bad-id', 'An id has a form no record id has.');
      const unique = [...new Set(list)];
      const found = unique.filter((i) => released.has(i));
      return json(200, { caseRef: c.ref, mode: 'ids', total: found.length, records: found.map((i) => records.get(i)), unknown: unique.filter((i) => !released.has(i)) });
    }

    if (!ID.test(entryId as string)) throw new Refusal(400, 'bad-id', 'An id has a form no entry id has.');
    const level = num('level', 0, 1, 5);
    if (level === 0) throw new Refusal(400, 'bad-query', 'The level query value is required with entry.');
    const offset = num('offset', 0, 0, 1_000_000);
    const limit = num('limit', 50, 1, 100);
    const entry = [...view.claims, ...view.hypotheses].find((x) => x.id === entryId);
    if (!entry) throw new Refusal(404, 'unknown-entry', 'This case has no such entry released.');
    const version = (entry.versions as { level: number | null; evidenceIds: string[] }[]).find((v) => v.level === level);
    if (!version) throw new Refusal(404, 'no-such-version', 'This entry has not held that level.');
    const recordIds = new Set<string>();
    const items: unknown[] = [];
    const indicators: { id: string; recordCount: number }[] = [];
    for (const id of version.evidenceIds) {
      const ind = view.indicators.find((x) => x.id === id);
      const item = view.evidenceItems.find((x) => x.id === id);
      if (records.has(id)) recordIds.add(id);
      else if (ind) {
        indicators.push({ id, recordCount: ind.recordIds.length });
        for (const r of ind.recordIds) recordIds.add(r);
      } else if (item) items.push(item);
    }
    const all = [...recordIds];
    return json(200, { caseRef: c.ref, mode: 'entry', entryId: entry.id, level, total: all.length, offset, limit, records: all.slice(offset, offset + limit).map((i) => records.get(i)), indicators, evidenceItems: items });
  };

  const postAction: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ['analyst']);
    const body = readBody(req, { kind: ['collect', 'hypotheses', 'test'], source: SOURCE }, ['source']);
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    const next = nextOf(c, file);
    const t = next?.trigger;
    const matches = !!t && t.kind === body.kind && (t.kind === 'collect' || t.kind === 'test' ? t.source === body.source : body.source === undefined);
    if (c.collections.some((x) => x.status === 'requested')) throw new Refusal(409, 'request-pending', 'A request to a source connector is still outstanding on this case.');
    if (!matches) throw new Refusal(409, 'not-next-action', next ? `The next action on this case is: ${next.actionLabel}.` : 'This case has no further action.');
    if (body.kind === 'hypotheses') {
      ws.write([ws.ev(u.id, u.role, 'hypotheses-recorded', { step: c.step + 1 }, c.ref)]);
      ws.releaseTo(c, c.step + 1, u.id, u.role);
      return json(201, rowOf(ws, ws.state().cases.get(c.ref) as CaseState));
    }
    const source = body.source as SourceCode;
    const conn = P().connectors.find((x) => x.source === source);
    // Turnaround is in feed minutes; the wall wait is that over the workspace feed speed, floored at 2 s and capped at 10 s.
    const speed = ws.state().feed.speed || P().defaultSpeed;
    const seconds = Math.min(10, Math.max(2, (conn?.turnaroundMinutes ?? 60) / speed));
    const requestId = `REQ-${c.ref.slice(-4)}-${c.collections.length + 1}`;
    ws.write([ws.ev(u.id, u.role, 'collection-request', { requestId, source, kind: body.kind as string, dueAt: new Date(opts.now().getTime() + seconds * 1000).toISOString(), turnaroundMinutes: conn?.turnaroundMinutes ?? 60 }, c.ref)]);
    const r = (ws.state().cases.get(c.ref) as CaseState).collections.find((x) => x.id === requestId) as Collection;
    const { kind: _k, ...out } = r;
    void _k;
    return json(201, out);
  };

  // ---- Handlers: sign-off, countersign, referral ---------------------------------------------------------------------

  function signRows(ws: Ws, c: CaseState, req: ApiRequest): (PlatformSignRow & { caseRef: string; actor: string })[] {
    const base = { simulated: true as const, browserId: browserId(req), caseRef: c.ref };
    const a = c.signs.map((x) => ({ ...base, at: x.at, actor: x.actor, entryId: x.entryId, kind: x.kind, role: 'analyst' as const, action: x.action, reasonCode: x.reasonCode }));
    const s = c.counters.map((x) => ({ ...base, at: x.at, actor: x.actor, entryId: x.entryId, kind: 'signature' as const, role: 'supervisor' as const, action: x.result, reasonCode: x.result === 'sign' ? 'SUP-PASSED' : 'SUP-RETURNED', checks: x.checks }));
    void ws;
    const seq = new Map<object, number>([...c.signs.map((x, i) => [a[i] as object, x.seq] as const), ...c.counters.map((x, i) => [s[i] as object, x.seq] as const)]);
    return [...a, ...s].sort((x, y) => (seq.get(x) as number) - (seq.get(y) as number));
  }

  const getSignoff: Handler = (req) => {
    const ws = workspace(req);
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    const view = releaseAt(c.scenario, c.step);
    const states = assessView(file, view).map((l) => ({ entryId: l.entryId, level: l.level, levelName: l.level === null ? 'No level' : LEVEL_NAMES[l.level], signable: l.level === 5, ...(l.level === 5 ? {} : { reason: lacks(file, view, l.entryId, l.level) }) }));
    return json(200, { caseRef: c.ref, rows: signRows(ws, c, req), states });
  };

  const postSignoff: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ['analyst']);
    const body = readBody(req, { entryId: ID, action: ['promote', 'hold', 'reject'], reasonCode: CODE });
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    if (c.referral || c.closed) throw new Refusal(409, 'case-closed', 'This case is closed. Nothing more can be recorded on it.');
    const si = signoffIndex(file);
    if (c.step < si - 1 || c.collections.some((x) => x.status === 'requested')) throw new Refusal(409, 'not-next-action', `The next action on this case is: ${nextOf(c, file)?.actionLabel ?? 'none'}.`);
    const view = releaseAt(c.scenario, c.step);
    const levels = levelsOf(c.scenario, c.step);
    const action = body.action as SignAction;
    if (!levels.has(body.entryId as string)) throw new Refusal(404, 'unknown-entry', 'This case has no such entry released.');
    const entryId = body.entryId as string;
    const level = levels.get(entryId) ?? null;
    if (action === 'promote' && level !== 5) {
      const held = level === null ? 'holds no level, because it fell' : `holds level ${level} (${LEVEL_NAMES[level]}), not level 5`;
      throw new Refusal(422, 'below-level-5', `Entry ${entryId} ${held}. It lacks: ${lacks(file, view, entryId, level)} Only a level 5 entry can be promoted.`);
    }
    const prepared = file.signoff.reasonCodes.find((r) => r.code === body.reasonCode && r.actions.includes(action) && r.entryIds.includes(entryId));
    if (!prepared) throw new Refusal(422, 'reason-not-prepared', 'That reason is not one of the prepared reasons for this entry and action.');
    const kind: SignRow['kind'] = action === 'promote' ? 'signature' : 'assessment';
    // A promotion is a signature; a hold or reject is an assessment record and is logged as one, never as a sign-off.
    ws.write([ws.ev(u.id, u.role, kind === 'signature' ? 'sign' : 'assessment-recorded', { entryId, kind, action, reasonCode: prepared.code, level: level ?? 'none' }, c.ref)]);
    let closed = false;
    if (kind === 'signature') {
      if (c.step < si) ws.releaseTo(c, si, u.id, u.role);
    } else if (view.signoff.signableEntryId === null) {
      // Nothing can be signed: the assessment record is the outcome and the case closes on it.
      ws.write([ws.ev(u.id, u.role, 'case-closed', { outcome: 'assessment-record', entryId }, c.ref)]);
      ws.releaseTo(c, lastIndex(file), u.id, u.role);
      closed = true;
    }
    const after = ws.state().cases.get(c.ref) as CaseState;
    const row = signRows(ws, after, req).filter((x) => x.role === 'analyst').at(-1);
    const message = kind === 'signature'
      ? 'Promotion recorded with the analyst signature. A supervisor, signed in as a different user, can now countersign.'
      : closed ? `Assessment record stored (${action}). The case closes as an assessment record. Nothing is referred.` : `Assessment record stored (${action}). It does not change any level.`;
    return json(201, { caseRef: c.ref, row, case: rowOf(ws, after), message });
  };

  const postSupervisor: Handler = (req) => {
    const ws = workspace(req, true);
    const u = userOf(req);
    if (!u) throw new Refusal(401, 'sign-in-required', 'Sign in as a demo account first (x-demo-user header).');
    const raw = parseBody(req, ['entryId', 'checks']);
    if (typeof raw.entryId !== 'string' || !ID.test(raw.entryId)) throw new Refusal(400, 'bad-value', 'entryId is missing or has a form no entry id has.');
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    if (c.referral || c.closed) throw new Refusal(409, 'case-closed', 'This case is closed. Nothing more can be recorded on it.');
    const entryId = raw.entryId;
    const spec = file.signoff.supervisorChecks;
    const checks = raw.checks;
    const valid = Array.isArray(checks) && checks.length === spec.length && checks.every((k) => k && typeof k === 'object' && !Array.isArray(k) && Object.keys(k).every((x) => x === 'id' || x === 'passed') && typeof k.id === 'string' && typeof k.passed === 'boolean') && spec.every((s) => (checks as { id: string }[]).filter((k) => k.id === s.id).length === 1);
    if (!valid) throw new Refusal(400, 'bad-value', 'checks must list each prepared supervisor check exactly once, with passed true or false.');
    const { analyst } = signatures(c, entryId);
    if (!analyst) throw new Refusal(409, 'nothing-to-countersign', 'There is no current analyst signature on this entry.');
    if (analyst.actor === u.id) throw new Refusal(403, 'same-user', 'The countersignature must come from a different user from the analyst who signed.');
    if (u.role !== 'supervisor') throw new Refusal(403, 'wrong-role', 'This action needs the supervisor role.');
    const level = levelsOf(c.scenario, c.step).get(entryId) ?? null;
    if (level !== 5) throw new Refusal(422, 'below-level-5', `Entry ${entryId} holds ${level === null ? 'no level' : `level ${level}`}. Only a level 5 entry is countersigned.`);
    const server: Record<string, boolean> = {
      'SC-1': level === 5,
      'SC-2': file.signoff.reasonCodes.some((r) => r.code === analyst.reasonCode && r.actions.includes('promote') && r.entryIds.includes(entryId)),
      'SC-3': file.assessment.notEstablished.length > 0,
    };
    const submitted = checks as { id: string; passed: boolean }[];
    if (submitted.some((k) => k.passed && server[k.id] !== true)) throw new Refusal(422, 'check-not-met', 'A check marked passed does not hold on the record.');
    const result = submitted.every((k) => k.passed) ? 'sign' : 'return';
    const ordered = spec.map((s) => ({ id: s.id, passed: (submitted.find((k) => k.id === s.id) as { passed: boolean }).passed }));
    ws.write([ws.ev(u.id, u.role, 'countersign', { entryId, result, analyst: analyst.actor, checks: ordered.map((k) => `${k.id}:${k.passed ? 'passed' : 'failed'}`).join(',') }, c.ref)]);
    const after = ws.state().cases.get(c.ref) as CaseState;
    return json(201, {
      caseRef: c.ref,
      result,
      checks: ordered.map((k) => ({ ...k, label: spec.find((s) => s.id === k.id)?.label ?? '' })),
      row: signRows(ws, after, req).filter((x) => x.role === 'supervisor').at(-1),
      case: rowOf(ws, after),
      message: result === 'sign' ? 'Countersignature recorded. The finding can be referred.' : 'Returned to the analyst. The promotion is no longer current.',
    });
  };

  /** The referral gate: a level 5 entry, a current analyst signature and a later countersign by a different user. */
  function gate(c: CaseState, _file: CaseFile, entryId: string) {
    const level = levelsOf(c.scenario, c.step).get(entryId) ?? null;
    if (level !== 5) throw new Refusal(422, 'referral-not-allowed', `Entry ${entryId} holds ${level === null ? 'no level' : `level ${level}`}, not level 5. Nothing can be referred.`);
    const { analyst, supervisor } = signatures(c, entryId);
    if (!analyst) throw new Refusal(422, 'referral-not-allowed', 'The latest analyst record for this entry is not a signature.');
    if (supervisor?.result !== 'sign' || supervisor.actor === analyst.actor) throw new Refusal(422, 'referral-not-allowed', 'A supervisor has not countersigned after the latest signature.');
    return { analyst, supervisor };
  }

  const sendRows = (c: CaseState, req: ApiRequest): PlatformSendRow[] =>
    c.referral ? c.referral.recipients.map((r) => ({ simulated: true, at: (c.referral as { at: string }).at, browserId: browserId(req), entryId: (c.referral as { entryId: string }).entryId, recipientId: r as SendRow['recipientId'], status: DELIVERED })) : [];

  const postReferral: Handler = (req) => {
    const ws = workspace(req, true);
    const u = needUser(req, ['analyst']);
    const body = parseBody(req, ['entryId'], true);
    if ('entryId' in body && (typeof body.entryId !== 'string' || !ID.test(body.entryId))) throw new Refusal(400, 'bad-value', 'entryId has a form no entry id has.');
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    if (c.referral) throw new Refusal(409, 'already-referred', 'This case was already referred. Nothing was added to the log.');
    if (c.closed) throw new Refusal(409, 'case-closed', 'This case closed as an assessment record. It cannot be referred.');
    const entryId = (body.entryId as string | undefined) ?? releaseAt(c.scenario, c.step).signoff.signableEntryId;
    if (!entryId) throw new Refusal(422, 'referral-not-allowed', 'No entry in this case holds level 5. Nothing can be referred.');
    const { analyst } = gate(c, file, entryId);
    // The analyst who signed disseminates: a different analyst, or anyone else, cannot send another person's finding.
    if (analyst.actor !== u.id) throw new Refusal(403, 'not-signing-analyst', 'Only the analyst who signed this finding can disseminate its referral.');
    if (nextOf(c, file)?.trigger.kind !== 'refer') throw new Refusal(409, 'not-next-action', `The next action on this case is: ${nextOf(c, file)?.actionLabel ?? 'none'}.`);
    const recipients = [...file.recipients].sort((a, b) => a.order - b.order).map((r) => r.id);
    ws.write([ws.ev(u.id, u.role, 'referral', { entryId, recipients: recipients.join(',') }, c.ref)]);
    ws.releaseTo(c, c.step + 1, u.id, u.role);
    const after = ws.state().cases.get(c.ref) as CaseState;
    return json(201, { caseRef: c.ref, rows: sendRows(after, req), case: rowOf(ws, after), message: 'Referral recorded in the in-app dissemination log. Nothing left this application.' });
  };

  const getLog: Handler = (req) => {
    const ws = workspace(req);
    const { c } = caseOf(ws, req.params.ref ?? '');
    return json(200, { caseRef: c.ref, rows: sendRows(c, req) });
  };

  const getPacket: Handler = (req) => {
    const ws = workspace(req);
    const { c, file } = caseOf(ws, req.params.ref ?? '');
    // The packet is a record of what was referred: it exists only once the referral has been disseminated, and it is
    // built from what the case has released by then, including the closing assessment.
    if (!c.referral) throw new Refusal(409, 'not-referred', 'The packet is available once the referral has been disseminated.');
    const view = releaseAt(c.scenario, c.step);
    if (!view.assessment) throw new Refusal(409, 'not-released', 'The closing assessment has not been released.');
    const entryId = c.referral.entryId;
    const { analyst, supervisor } = gate(c, file, entryId);
    const alert = P().alerts.find((a) => a.id === c.alertId) as PlatformAlert;
    const name = (id: string) => DEMO_USERS.find((x) => x.id === id)?.displayName ?? id;
    const reason = (code: string) => file.signoff.reasonCodes.find((r) => r.code === code)?.label ?? 'Prepared reason';
    const signer = (x: { actor: string; at: string }, role: string, action: string, why: string): Signer => ({ displayName: name(x.actor), role, action, reason: why, at: x.at });
    const checks = supervisor.checks.map((k) => `${file.signoff.supervisorChecks.find((s) => s.id === k.id)?.label ?? k.id} ${k.passed ? 'Passed.' : 'Failed.'}`).join(' ');
    const out = buildPacket({
      view,
      assessment: view.assessment,
      levels: levelsOf(c.scenario, c.step),
      caseRef: c.ref,
      meta: file.meta,
      raisedBy: { alertId: alert.id, title: alert.title, ruleId: alert.detection.ruleId, at: alert.detection.at },
      analyst: signer(analyst, 'analyst', 'promote and sign', reason(analyst.reasonCode)),
      supervisor: signer(supervisor, 'supervisor', 'countersign', checks),
      recipients: file.recipients,
    });
    return html(200, out, {
      'content-disposition': `attachment; filename="SIMULATED-referral-${c.ref}.html"`,
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'",
    });
  };

  // ---- Handlers: audit ---------------------------------------------------------------------------------------------

  const getAudit: Handler = (req) => {
    const ws = workspace(req);
    const ref = req.query.get('caseRef');
    if (ref !== null && !REF.test(ref)) throw new Refusal(400, 'bad-query', 'caseRef has a form no case reference has.');
    return json(200, store.read(ws.id).filter((e) => ref === null || e.caseRef === ref));
  };

  const getVerify: Handler = (req) => {
    const ws = workspace(req);
    return json(200, ws.chain);
  };

  // ---- Route table -------------------------------------------------------------------------------------------------

  const guard =
    (h: Handler): Handler =>
    async (req) => {
      try {
        return await h(req);
      } catch (e) {
        if (e instanceof Refusal) return refusalResponse(e);
        if (e instanceof ChainBroken) return refusalResponse(new Refusal(409, 'audit-chain-broken', `The audit trail of this workspace fails verification (${e.verdict.reason ?? 'it was altered'}). Nothing can be recorded until it is investigated.`));
        return json(500, { error: { code: 'internal', message: 'The platform hit an unexpected fault.' } });
      }
    };

  const routes: Route[] = (
    [
      ['GET', '/api/session', getSession],
      ['GET', '/api/feed/status', getFeed],
      ['POST', '/api/feed/start', postFeedStart],
      ['POST', '/api/feed/pause', postFeedPause],
      ['POST', '/api/workspace/reset', postReset],
      ['GET', '/api/alerts', getAlerts],
      ['GET', '/api/alerts/:id/baseline', getBaseline],
      ['POST', '/api/alerts/:id/dismiss', postDismiss],
      ['POST', '/api/alerts/:id/open', postOpen],
      ['GET', '/api/cases', listCases],
      ['GET', '/api/cases/:ref', getCase],
      ['GET', '/api/cases/:ref/records', getRecords],
      ['POST', '/api/cases/:ref/actions', postAction],
      ['GET', '/api/cases/:ref/signoff', getSignoff],
      ['POST', '/api/cases/:ref/signoff', postSignoff],
      ['POST', '/api/cases/:ref/supervisor', postSupervisor],
      ['POST', '/api/cases/:ref/referral', postReferral],
      ['GET', '/api/cases/:ref/referral/log', getLog],
      ['GET', '/api/cases/:ref/referral/packet', getPacket],
      ['GET', '/api/audit', getAudit],
      ['GET', '/api/audit/verify', getVerify],
    ] as Route[]
  ).map(([m, p, h]) => [m, p, guard(h)] as Route);

  function match(pattern: string, path: string): Record<string, string> | null {
    const a = pattern.split('/');
    const b = path.replace(/\/+$/, '').split('/');
    if (a.length !== b.length) return null;
    const params: Record<string, string> = {};
    for (let i = 0; i < a.length; i++) {
      const p = a[i] as string;
      const v = b[i] as string;
      if (p.startsWith(':')) {
        if (!v) return null;
        try {
          params[p.slice(1)] = decodeURIComponent(v);
        } catch {
          return null;
        }
      } else if (p !== v) return null;
    }
    return params;
  }

  /** Route lookup plus dispatch. Hosts call this with a request whose `params` is empty. */
  async function handle(req: Omit<ApiRequest, 'params'> & { params?: Record<string, string> }): Promise<ApiResponse> {
    let pathMatched = false;
    for (const [method, pattern, handler] of routes) {
      const params = match(pattern, req.path);
      if (!params) continue;
      pathMatched = true;
      if (method === req.method) return handler({ ...req, params });
    }
    return pathMatched
      ? json(405, { error: { code: 'method-not-allowed', message: 'This path does not accept that method.' } })
      : json(404, { error: { code: 'not-found', message: 'There is no such path.' } });
  }

  return { routes, handle };
}
export type Api = ReturnType<typeof createApi>;
export { CASE_IDS };
