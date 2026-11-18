// SOLID SNAKE data contract. One shape, read by the generator, the API, the prerender and the tests.
// Everything here is simulated. Field names of charging records follow 3GPP TS 32.260 (see FIELD_NAMES).

export type Level = 1 | 2 | 3 | 4 | 5;
export const LEVEL_NAMES: Record<Level, string> = {
  1: 'Observed fact',
  2: 'Analytical indicator',
  3: 'Correlated evidence',
  4: 'Investigative hypothesis',
  5: 'Verified finding',
};

/** Provenance label for rules, fields, mechanisms, roles. Never used for claims: claims carry a Level. */
export type Basis = 'FACT' | 'RESEARCH' | 'PRACTICE' | 'ASSUMPTION' | 'FICTION' | 'PROPOSAL';

export type CaseId = 'a' | 'b' | 'c' | 'd';
export type StageId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const STAGE_NAMES: Record<StageId, string> = {
  1: 'Signal',
  2: 'Evidence',
  3: 'Rivals',
  4: 'Test',
  5: 'Sign-off',
  6: 'Referral',
  7: 'Outcome',
};

export type SourceCode = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7';

export interface Source {
  code: SourceCode;
  name: string;
  /** Plain-language name shown first in the interface, for example "Call records". No abbreviations. */
  plainName?: string;
  /** One sentence a non-specialist can follow: what this source is and who holds it. */
  explain?: string;
  system: string;
  method: string;
  collectionPoint: string;
  basis: Basis;
  basisNote: string;
}

export interface Independence {
  id: string;
  pair: [SourceCode, SourceCode];
  differentSystem: boolean;
  differentMethod: boolean;
  differentCollectionPoint: boolean;
  sharedFailureModes: string;
  /** The sentence shown on screen with every level 3 claim that rests on this pair. */
  statement: string;
}

// ---- Records (E1, E2) --------------------------------------------------------------------------

export type LocationSupplier = 'network-provided' | 'device-reported';

/** S-CSCF CDR subset, TS 32.260 Table 6.1.3.3.1. Optional (OC) fields may be absent: that is a normal state. */
export interface ScscfRecord {
  simulated: true;
  id: string;
  recordType: 'sCSCFRecord';
  roleOfNode: 'originating' | 'terminating';
  nodeAddress: string;
  sessionId: string;
  imsChargingIdentifier: string;
  localRecordSequenceNumber: number;
  listOfCallingPartyAddress: string;
  listOfSubscriptionId: string;
  requestedPartyAddress?: string;
  calledPartyAddress: string;
  serviceRequestTimeStamp: string;
  serviceDeliveryStartTimeStamp: string;
  serviceDeliveryEndTimeStamp?: string;
  causeForRecordClosing: string;
  serviceReasonReturnCode: number;
  /** Network-provided location, captured at answer. cellRef points at a fictional sector in MapModel. */
  userLocationInfo?: { tai: string; ecgi: string; cellRef: string };
  accessNetworkInformation?: { value: string; supplier: LocationSupplier; cellRef: string };
  subscriberEquipmentNumber?: string;
  instanceId?: string;
  originatingIoi?: string;
  terminatingIoi?: string;
}

/** IBCF CDR subset, TS 32.260 Table 6.1.3.10.1. */
export interface IbcfRecord {
  simulated: true;
  id: string;
  recordType: 'iBCFRecord';
  roleOfNode: 'originating' | 'terminating';
  nodeAddress: string;
  sessionId: string;
  imsChargingIdentifier: string;
  listOfCallingPartyAddress: string;
  calledPartyAddress: string;
  serviceRequestTimeStamp: string;
  serviceDeliveryStartTimeStamp: string;
  serviceDeliveryEndTimeStamp?: string;
  nniInformation: { sessionDirection: 'inbound' | 'outbound'; nniType: string; relationshipMode: string; neighbourNodeAddress: string };
  originatingIoi?: string;
  /** Symbolic route token, for example ROUTE-INTL-03. */
  routeRef: string;
}

export type AnyRecord = ScscfRecord | IbcfRecord;

/** Display names exactly as the specification prints them, with category and clause. Used for V8. */
export interface FieldSpec {
  key: string;
  specName: string;
  /** Plain-language label shown first, for example "Time the call was answered". The spec name is the technical detail. */
  plainName?: string;
  /** One sentence explaining the field to a non-specialist. */
  explain?: string;
  category: 'M' | 'OM' | 'OC';
  spec: 'TS 32.260 Table 6.1.3.3.1' | 'TS 32.260 Table 6.1.3.10.1';
}

/** Evidence that is not a charging record (E3 to E7). */
export interface EvidenceItem {
  simulated: true;
  id: string;
  source: SourceCode;
  title: string;
  /** Plain statement of what the item shows, worded at level 1. */
  summary: string;
  fields: Record<string, string | number>;
  basis: Basis;
  basisNote: string;
}

// ---- Rules and indicators ----------------------------------------------------------------------

export interface Rule {
  id: string;
  name: string;
  /** What the rule computes, in words. Must be enough to reproduce the indicator from its records. */
  description: string;
  basis: Basis;
  /** Citation or "ASSUMPTION: ..." text. */
  sourceNote: string;
}

export interface Indicator {
  id: string;
  ruleId: string;
  source: SourceCode;
  description: string;
  /** Reproducible from recordIds with the rule. */
  value: number;
  unit: string;
  baseline: { id: string; description: string; value: number; population: string };
  window: { start: string; end: string };
  /** Position relative to the baseline, in words. A sort key, never a probability. */
  position: 'above' | 'below' | 'within';
  recordIds: string[];
}

// ---- Claims, hypotheses, expectations ----------------------------------------------------------

/** One level of an evidence claim. A claim keeps every version it has held. */
export interface ClaimVersion {
  level: 1 | 2 | 3;
  /** Template wording from PRODUCT.md 2.4 for this level. */
  statement: string;
  /** Ids of records, indicators or evidence items that produced this version. Never empty. */
  evidenceIds: string[];
  ruleId?: string;
  sources: SourceCode[];
  /** Required at level 3. */
  independenceId?: string;
  /** Step at which this version becomes current. */
  step: number;
}

export interface Claim {
  kind: 'evidence';
  id: string;
  /** Fixed subject, for example "Voice activity of SIM group G". */
  subject: string;
  versions: ClaimVersion[];
  /** Expectations that limit this claim. */
  limitedBy: string[];
}

export type HypothesisState = 'open' | 'verified' | 'fallen';

export interface HypothesisVersion {
  step: number;
  state: HypothesisState;
  /** 4 while open, 5 when verified, null once fallen. */
  level: 4 | 5 | null;
  statement: string;
  /** Evidence added at this step. Never empty. */
  evidenceIds: string[];
}

export interface Hypothesis {
  kind: 'hypothesis';
  id: string;
  name: string;
  /** Evidence claims this hypothesis rests on. */
  cites: string[];
  /** Competing hypothesis ids. Never empty while open. */
  rivals: string[];
  /** Whether this explanation is an innocent one (call centre, M2M fleet, calling campaign). */
  innocent: boolean;
  /** What observation would support it and what would refute it. */
  support: string;
  refute: string;
  tests: { description: string; needs: string; status: 'requested' | 'returned' | 'not-returned' }[];
  versions: HypothesisVersion[];
  /** Map shape that draws what this explanation predicts, if any. */
  footprintShapeId?: string;
}

export type Entry = Claim | Hypothesis;

export interface Expectation {
  id: string;
  /** What was expected, in words. */
  what: string;
  fromSource: SourceCode;
  ruleId: string;
  window: { start: string; end: string };
  /** State over time. */
  timeline: { step: number; state: 'not-observed' | 'observed' | 'withdrawn' }[];
  /** Entry ids this absence limits or supports. */
  limits: string[];
}

// ---- The walk ----------------------------------------------------------------------------------

export type NarrativeBlock =
  /** A statement about an entry. Rendered with that entry's level. */
  | { kind: 'claim'; text: string; entryId: string; level: Level }
  /** Background: a mechanism, a definition, a limit of the records. Rendered with its basis. */
  | { kind: 'context'; text: string; basis: Basis; sourceNote: string }
  /** What cannot be said at this point. */
  | { kind: 'limit'; text: string };

export type Change =
  | { type: 'stage'; stage: StageId; announce: string }
  | { type: 'level-rise'; entryId: string; from: Level | null; to: Level; evidenceIds: string[]; announce: string }
  | { type: 'level-fall'; entryId: string; from: Level; evidenceIds: string[]; announce: string }
  | { type: 'map'; announce: string }
  | { type: 'spotlight'; exhibitId: string; announce: string };

// ---- Enterprise presentation: case metadata, minimised entities, analytical charts --------------

/** How a real unit heads a case file. All values are synthetic. */
export interface CaseMeta {
  /** Case reference in the unit's scheme, for example "TFIU/2031/0147". */
  reference: string;
  opened: string;
  /** Who referred the matter, as a minimised entity, for example "MNO-1 revenue assurance". */
  originator: string;
  tasking: string;
  desk: string;
  priority: 'Routine' | 'Priority' | 'Immediate';
  /** Always "SIMULATED // EXERCISE DATA". */
  handling: string;
}

/** Minimised entity reference, the way an intelligence product names organisations. Never a real organisation. */
export interface Entity {
  id: string;
  /** Plain first-layer name, for example "Operator 1". The id (MNO-1) is the technical reference. */
  plainName: string;
  kind: 'Mobile network operator' | 'Interconnect carrier' | 'Enterprise customer' | 'Unit' | 'Regulator' | 'Law enforcement';
  role: string;
  basis: 'FICTION';
}

export interface ChartSeries {
  id: string;
  label: string;
  role: 'subject' | 'population' | 'baseline' | 'expected' | 'observed';
  values: number[];
}

/**
 * An analytical graphic. Every chart is bound to an entry (so it shows that entry's level) and is reproducible
 * from records through its rule: a test recomputes series from recordIds.
 */
export interface Chart {
  id: string;
  kind: 'timeseries' | 'distribution' | 'comparison' | 'links';
  title: string;
  entryId: string;
  source: SourceCode;
  ruleId: string;
  unit: string;
  xLabel: string;
  yLabel: string;
  /** timeseries: width of each bucket in minutes from the window start. */
  bucketMinutes?: number;
  /** distribution and comparison: category or bin labels, same length as each series. */
  categories?: string[];
  series: ChartSeries[];
  /** Baseline band for a time series, same length as the series. */
  band?: { label: string; low: number[]; high: number[] };
  /** Where the subject sits in a distribution. An ordering, never a probability. */
  marker?: { label: string; value: number };
  /** links: subscriptions, devices, cells, routes or ranges and what ties them. */
  graph?: {
    nodes: { id: string; label: string; type: 'subscription' | 'device' | 'cell' | 'route' | 'range' | 'party' }[];
    edges: { from: string; to: string; weight: number }[];
  };
  note: string;
  basis: Basis;
  recordIds: string[];
}

export interface Exhibit {
  id: string;
  /** What is shown: a record sample, an indicator, an evidence item, an expectation, a hypothesis card, a chart. */
  kind: 'records' | 'indicator' | 'evidence' | 'expectation' | 'hypothesis' | 'assessment' | 'chart';
  refId: string;
  /** Museum label fields: the provenance layer. */
  label: { accession: string; medium: string; collectionPoint: string; window: string; level: Level | null; basis: Basis };
}

/**
 * What moves a case to this step. In the platform a step is released by an analyst action or by a connector
 * returning data, never by scrolling. 'open' is the step the case opens on from its alert.
 */
export type StepTrigger =
  | { kind: 'open' }
  | { kind: 'auto' }
  | { kind: 'collect'; source: SourceCode }
  | { kind: 'hypotheses' }
  | { kind: 'test'; source: SourceCode }
  | { kind: 'signoff' }
  | { kind: 'refer' }
  | { kind: 'close' };

export interface Step {
  index: number;
  stage: StageId;
  id: string;
  title: string;
  /** Platform: what releases this step. Optional only until the generator fills it for every step. */
  trigger?: StepTrigger;
  /** Plain-language label of the action that releases it, for example "Request international gateway records". */
  actionLabel?: string;
  narrative: NarrativeBlock[];
  exhibits: Exhibit[];
  /** Every animated change at this step. Each names what changed. */
  changes: Change[];
}

// ---- Map ---------------------------------------------------------------------------------------

export type Plate = 'national' | 'case';
export type Point = [number, number];

export interface MapShape {
  id: string;
  kind: 'region' | 'sector' | 'observation-area' | 'band' | 'cluster' | 'footprint' | 'verified-site' | 'seal' | 'route';
  plate: Plate;
  /**
   * national plate: [longitude, latitude]. case plate: [x km, y km] on the fictional grid.
   * Areas use exactly AREA_POINTS points so any two areas can be interpolated.
   */
  points: Point[];
  /** Entry this geometry is bound to. Every shape has one, except 'route' and 'seal' which bind to the referral or sign-off. */
  boundTo: string;
  label: string;
  derivation: string;
  supplier?: LocationSupplier;
  basis: Basis;
}

export const AREA_POINTS = 64;

export interface MapState {
  step: number;
  plate: Plate;
  /** The single uncertainty area at this step, AREA_POINTS points, or null when no geographic claim exists. */
  area: { shapeId: string; areaKm2: number } | null;
  /** Other shapes on show, with how they are drawn. */
  shapes: { shapeId: string; style: 'lit' | 'hatched' | 'dashed' | 'solid' | 'dissolved' | 'history' }[];
  /** Lit shape: where attention is. Light never encodes level. */
  spotlightShapeId: string | null;
  note: string;
}

export interface MapModel {
  /** Broad region on the real outline, tens of kilometres across. Null when no record carries a location. */
  region: { shapeId: string; label: string } | null;
  casePlate: {
    widthKm: number;
    heightKm: number;
    disclaimer: string;
    /** Fictional sectors. Sites are not drawn as marks: a site is only the apex of its sector. */
    sectors: { cellRef: string; apex: Point; azimuthDeg: number; beamwidthDeg: number; rangeKm: number; basis: 'ASSUMPTION' }[];
  };
  shapes: MapShape[];
  states: MapState[];
}

// ---- Sign-off, referral, assessment ------------------------------------------------------------

export type SignAction = 'promote' | 'hold' | 'reject';

export interface SignoffSpec {
  /** The level 5 entry that can be signed, or null. */
  signableEntryId: string | null;
  /** Shown when nothing can be signed: every open entry with what it lacks, equal weight. */
  openEntries: { entryId: string; level: Level | null; lacks: string }[];
  /** Prepared reasons. There is no free text anywhere. */
  reasonCodes: { code: string; label: string; actions: SignAction[]; entryIds: string[] }[];
  supervisorChecks: { id: string; label: string }[];
}

export type RecipientId = 'unit-lead' | 'agency-head' | 'regulator-desk' | 'law-enforcement-desk';

export interface RecipientRole {
  id: RecipientId;
  title: string;
  basis: 'FICTION';
  /** Visible marker that the role is not a real body. Always "(simulated role)". */
  label: string;
  order: number;
}

export interface Assessment {
  /** Headings bound to entries. Not free-standing claims. */
  captions: { text: string; entryIds: string[] }[];
  established: string[];
  suggested: string[];
  notEstablished: string[];
  outcome: 'signed-and-referred' | 'assessment-record';
}

// ---- The case ----------------------------------------------------------------------------------

export interface CaseSummary {
  simulated: true;
  id: CaseId;
  code: string;
  /** Neutral on-screen title. Never the catalogue role from PRODUCT.md Part 12. */
  title: string;
  lede: string;
  window: { start: string; end: string };
  meta?: CaseMeta;
  /** Every technical term the interface cannot avoid, with a plain name and a one-sentence explanation. */
  glossary?: { term: string; plain: string; explain: string }[];
  entities?: Entity[];
  charts?: Chart[];
  sources: Source[];
  independence: Independence[];
  rules: Rule[];
  indicators: Indicator[];
  evidenceItems: EvidenceItem[];
  claims: Claim[];
  hypotheses: Hypothesis[];
  expectations: Expectation[];
  steps: Step[];
  map: MapModel;
  signoff: SignoffSpec;
  recipients: RecipientRole[];
  assessment: Assessment;
  fieldSpecs: FieldSpec[];
  /** Compact strip data: one tuple per originating record of interest. [minutes from window start, lane index, duration seconds, record id] */
  strip: { lanes: string[]; ticks: [number, number, number, string][] };
  recordCounts: { scscf: number; ibcf: number };
}

/** What the generator writes to data/generated/case-<id>.json. The API serves CaseSummary and pages records on request. */
export interface CaseFile extends CaseSummary {
  records: { scscf: ScscfRecord[]; ibcf: IbcfRecord[] };
}

/** Written to data/generated/ground-truth.json. Never served, never bundled, never prerendered. */
export interface GroundTruth {
  simulated: true;
  cases: Record<CaseId, { role: string; truth: string }>;
}

export interface Manifest {
  simulated: true;
  seed: number;
  generatedBy: string;
  files: { name: string; sha256: string; records: number }[];
}

// ---- Persisted rows (API) ----------------------------------------------------------------------

export interface SignRow {
  simulated: true;
  at: string;
  browserId: string;
  caseId: CaseId;
  entryId: string;
  /** 'signature' only at level 5. 'assessment' is never called a sign-off. */
  kind: 'signature' | 'assessment';
  role: 'analyst' | 'supervisor';
  action: SignAction | 'sign' | 'return';
  reasonCode: string;
  /** Supervisor rows list each check and whether it passed. */
  checks?: { id: string; passed: boolean }[];
}

export interface SendRow {
  simulated: true;
  at: string;
  browserId: string;
  caseId: CaseId;
  entryId: string;
  recipientId: RecipientId;
  status: 'delivered (simulated)' | 'withdrawn after send (simulated)';
}

// ---- Platform: feed, detection, alerts, cases, users, audit -------------------------------------
// The platform ingests call records, runs detection rules over every record, raises alerts, and works each
// case from alert to sign-off. In the demo the feed is synthetic and each source connector returns prepared
// synthetic data, because no operator is connected. Swapping a connector for a real one is the integration seam.

/** One line of data/generated/feed.ndjson: background traffic and the four scenarios, interleaved by start time. */
export type FeedLine = AnyRecord;

/** A source connector: how the platform asks a source for evidence. Demo connectors return synthetic data. */
export interface ConnectorInfo {
  source: SourceCode;
  plainName: string;
  mode: 'demo-synthetic' | 'live';
  /** Simulated turnaround shown to the analyst, in feed minutes. */
  turnaroundMinutes: number;
}

/** A rule firing on the feed. Computed by the detection engine from records, never authored. */
export interface Detection {
  id: string;
  ruleId: string;
  /** Feed time at which the rule fired. */
  at: string;
  subject: { kind: 'subscription-group' | 'route' | 'number-range'; ref: string; plainName: string };
  value: number;
  unit: string;
  baseline: { value: number; description: string };
  position: 'above' | 'below' | 'within';
  recordIds: string[];
}

export type AlertStatus = 'new' | 'case-opened' | 'dismissed';

export interface Alert {
  simulated: true;
  id: string;
  detection: Detection;
  /** Plain-language title, for example "Unusual outbound calling from a group of 38 SIMs". */
  title: string;
  severity: 'Routine' | 'Priority' | 'Immediate';
  /** Broad region on the national plate, or null when no record carries a location. */
  regionShapeId: string | null;
  status: AlertStatus;
  /** Scenario whose evidence the demo connectors serve for this alert. Not shown as a "story" anywhere. */
  scenario: CaseId;
  caseRef?: string;
  dismissReasonCode?: string;
}

export type CaseStatus =
  | 'open'
  | 'awaiting-collection'
  | 'awaiting-test'
  | 'awaiting-sign-off'
  | 'awaiting-supervisor'
  | 'referred'
  | 'closed-assessment';

export interface CollectionRequest {
  id: string;
  caseRef: string;
  source: SourceCode;
  requestedAt: string;
  requestedBy: string;
  dueAt: string;
  status: 'requested' | 'returned' | 'not-returned';
  returnedAt?: string;
}

export type Role = 'analyst' | 'supervisor' | 'unit-lead';

/** Demo accounts. Fictional people, role titles only. */
export interface DemoUser {
  id: string;
  displayName: string;
  role: Role;
  basis: 'FICTION';
}

/** Runtime case: one per opened alert, per demo workspace. Its content is the scenario's CaseFile released step by step. */
export interface CaseRow {
  simulated: true;
  ref: string;
  workspaceId: string;
  alertId: string;
  scenario: CaseId;
  openedAt: string;
  openedBy: string;
  assignee: string;
  /** Highest released step index. levelAt(entry, step) gives every level. */
  step: number;
  status: CaseStatus;
  collections: CollectionRequest[];
}

/** Append-only, hash-chained. Every state change on the platform writes one. */
export interface AuditEvent {
  simulated: true;
  seq: number;
  at: string;
  workspaceId: string;
  actor: string;
  role: Role | 'system';
  action: string;
  caseRef?: string;
  detail: Record<string, string | number>;
  prevHash: string;
  hash: string;
}

// ---- Helpers -----------------------------------------------------------------------------------

export function levelAt(entry: Entry, step: number): Level | null {
  if (entry.kind === 'evidence') {
    let level: Level | null = null;
    for (const v of entry.versions) if (v.step <= step) level = v.level;
    return level;
  }
  let level: Level | null = null;
  for (const v of entry.versions) if (v.step <= step) level = v.level;
  return level;
}

export function finalLevel(entry: Entry): Level | null {
  return levelAt(entry, Number.MAX_SAFE_INTEGER);
}

/** PRODUCT.md 2.4 rule 6. Allowed only at level 5 in simulated context. */
export const RESERVED_WORDS = ['confirmed', 'fraudster', 'caught', 'perpetrator'] as const;
