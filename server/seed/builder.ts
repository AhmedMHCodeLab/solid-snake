// Assembles a CaseFile from a declarative case description. Levels, changes, announcements, exhibit labels and
// limitedBy links are derived here so every case obeys the same rules.
import { STAGE_NAMES, levelAt } from '../../shared/types';
import type {
  AnyRecord, Assessment, Basis, CaseFile, CaseId, CaseMeta, Change, Chart, Claim, ClaimVersion, Entity, Entry, EvidenceItem, Exhibit, Expectation, FieldSpec, Hypothesis,
  HypothesisVersion, Indicator, Independence, Level, MapModel, MapShape, MapState, NarrativeBlock, RecipientRole, Rule, SignoffSpec, Source, StageId, Step, StepTrigger,
} from '../../shared/types';
import { SOURCES } from './sources';
import { W } from './wording';
import { glossaryFor } from './glossary';

export type ClaimVersionDef = ClaimVersion & { added: string };
export type ClaimDef = Omit<Claim, 'limitedBy' | 'versions'> & { versions: ClaimVersionDef[] };
export type HypVersionDef = HypothesisVersion & { added: string };
export type HypDef = Omit<Hypothesis, 'versions'> & { versions: HypVersionDef[] };

export type BlockDef = { k: 'claim'; id: string; extra?: string } | { k: 'ctx'; text: string; basis: Basis; note: string } | { k: 'lim'; text: string };
export const cl = (id: string, extra?: string): BlockDef => (extra === undefined ? { k: 'claim', id } : { k: 'claim', id, extra });
export const ctx = (text: string, basis: Basis, note: string): BlockDef => ({ k: 'ctx', text, basis, note });
export const lim = (text: string): BlockDef => ({ k: 'lim', text });

export interface StepDef {
  stage: StageId;
  title: string;
  trigger: StepTrigger;
  actionLabel: string;
  blocks: BlockDef[];
  exhibits: { kind: Exhibit['kind']; refId: string }[];
  /** Required whenever the map state differs from the previous step. */
  mapAnnounce?: string;
  stageAnnounce?: string;
}

export interface MapStateDef {
  plate: 'national' | 'case';
  area: string | null;
  shapes: [string, MapState['shapes'][number]['style']][];
  spot: string | null;
  note: string;
}

export interface CaseInput {
  L: string;
  id: CaseId;
  code: string;
  title: string;
  lede: string;
  window: { start: string; end: string };
  meta: CaseMeta;
  entities: Entity[];
  charts: Chart[];
  sources: Source[];
  independence: Independence[];
  rules: Rule[];
  indicators: Indicator[];
  evidenceItems: EvidenceItem[];
  claims: ClaimDef[];
  hypotheses: HypDef[];
  expectations: Expectation[];
  steps: StepDef[];
  map: { region: MapModel['region']; casePlate: MapModel['casePlate']; shapes: MapShape[]; areas: Record<string, number>; states: MapStateDef[] };
  signoff: SignoffSpec;
  recipients: RecipientRole[];
  assessment: Assessment;
  fieldSpecs: FieldSpec[];
  strip: CaseFile['strip'];
  records: { scscf: CaseFile['records']['scscf']; ibcf: CaseFile['records']['ibcf'] };
}

const EXHIBIT_WORDS: Record<Exhibit['kind'], string> = {
  records: 'call record',
  indicator: 'indicator',
  evidence: 'evidence item',
  expectation: 'expected evidence',
  hypothesis: 'explanation',
  assessment: 'assessment',
  chart: 'chart',
};

const windowText = (w: { start: string; end: string }): string => `${w.start.slice(0, 10)} to ${w.end.slice(0, 10)}, simulated clock`;

export function assemble(c: CaseInput): CaseFile {
  const claims: Claim[] = c.claims.map((d) => ({
    kind: 'evidence',
    id: d.id,
    subject: d.subject,
    versions: d.versions.map(({ added: _a, ...v }) => v),
    limitedBy: c.expectations.filter((e) => e.limits.includes(d.id)).map((e) => e.id),
  }));
  const hypotheses: Hypothesis[] = c.hypotheses.map((d) => ({ ...d, versions: d.versions.map(({ added: _a, ...v }) => v) }));
  const entries: Entry[] = [...claims, ...hypotheses];
  const entry = (id: string): Entry => {
    const e = entries.find((x) => x.id === id);
    if (!e) throw new Error(`${c.id}: unknown entry ${id}`);
    return e;
  };
  const versionAt = (id: string, step: number): { text: string; level: Level | null } => {
    const e = entry(id);
    const vs = e.versions.filter((v) => v.step <= step);
    const v = vs[vs.length - 1];
    if (!v) throw new Error(`${c.id}: ${id} has no version at step ${step}`);
    return { text: v.statement, level: levelAt(e, step) };
  };

  const recordIndex = new Map<string, AnyRecord>();
  for (const x of [...c.records.scscf, ...c.records.ibcf]) recordIndex.set(x.id, x);

  const exhibitLabel = (kind: Exhibit['kind'], refId: string, step: number): Exhibit['label'] => {
    const win = windowText(c.window);
    const src = (code: keyof typeof SOURCES) => ({ medium: `${SOURCES[code].plainName} (${code})`, collectionPoint: SOURCES[code].collectionPoint });
    if (kind === 'records') {
      const code = refId.startsWith('IBCF') ? 'E2' : 'E1';
      if (!recordIndex.has(refId)) throw new Error(`${c.id}: exhibit record ${refId} missing`);
      return { accession: refId, ...src(code), window: win, level: 1, basis: 'FICTION' };
    }
    if (kind === 'chart') {
      const ch = c.charts.find((i) => i.id === refId);
      if (!ch) throw new Error(`${c.id}: exhibit chart ${refId} missing`);
      return { accession: refId, ...src(ch.source), window: win, level: levelAt(entry(ch.entryId), step), basis: ch.basis };
    }
    if (kind === 'indicator') {
      const ind = c.indicators.find((i) => i.id === refId);
      if (!ind) throw new Error(`${c.id}: exhibit indicator ${refId} missing`);
      const rule = c.rules.find((x) => x.id === ind.ruleId) as Rule;
      return { accession: refId, ...src(ind.source), window: win, level: 2, basis: rule.basis };
    }
    if (kind === 'evidence') {
      const it = c.evidenceItems.find((i) => i.id === refId);
      if (!it) throw new Error(`${c.id}: exhibit evidence ${refId} missing`);
      return { accession: refId, ...src(it.source), window: win, level: 1, basis: it.basis };
    }
    if (kind === 'expectation') {
      const ex = c.expectations.find((i) => i.id === refId);
      if (!ex) throw new Error(`${c.id}: exhibit expectation ${refId} missing`);
      return { accession: refId, ...src(ex.fromSource), window: win, level: null, basis: 'ASSUMPTION' };
    }
    if (kind === 'hypothesis') {
      const e = entry(refId);
      return { accession: refId, medium: 'Explanation under test', collectionPoint: 'Analyst working record', window: win, level: levelAt(e, step), basis: 'ASSUMPTION' };
    }
    entry(refId);
    return { accession: refId, medium: 'Assessment record', collectionPoint: 'Case assessment', window: win, level: null, basis: 'PROPOSAL' };
  };

  const steps: Step[] = c.steps.map((d, index) => {
    const narrative: NarrativeBlock[] = d.blocks.map((b): NarrativeBlock => {
      if (b.k === 'ctx') return { kind: 'context', text: b.text, basis: b.basis, sourceNote: b.note };
      if (b.k === 'lim') return { kind: 'limit', text: b.text };
      const v = versionAt(b.id, index);
      if (v.level === null) throw new Error(`${c.id}: claim block for fallen entry ${b.id} at step ${index}`);
      return { kind: 'claim', text: b.extra ? `${v.text} ${b.extra}` : v.text, entryId: b.id, level: v.level };
    });
    const exhibits: Exhibit[] = d.exhibits.map((e, k) => ({ id: `EX-${c.L}-${index}-${k + 1}`, kind: e.kind, refId: e.refId, label: exhibitLabel(e.kind, e.refId, index) }));
    const changes: Change[] = [];
    const prevStage = index === 0 ? null : (c.steps[index - 1] as StepDef).stage;
    if (prevStage !== d.stage) changes.push({ type: 'stage', stage: d.stage, announce: d.stageAnnounce ?? `Stage ${d.stage}, ${STAGE_NAMES[d.stage]}.` });
    for (const cd of c.claims) {
      cd.versions.forEach((v, vi) => {
        if (v.step !== index) return;
        const from = vi === 0 ? null : (cd.versions[vi - 1] as ClaimVersionDef).level;
        if (from === v.level) return;
        changes.push({ type: 'level-rise', entryId: cd.id, from, to: v.level, evidenceIds: v.evidenceIds.length > 12 ? v.evidenceIds.slice(0, 3) : v.evidenceIds, announce: W.rise(cd.id, from, v.level, v.added) });
      });
    }
    for (const hd of c.hypotheses) {
      hd.versions.forEach((v, vi) => {
        if (v.step !== index) return;
        const prev = vi === 0 ? null : (hd.versions[vi - 1] as HypVersionDef).level;
        if (prev === v.level) return;
        if (v.level === null) changes.push({ type: 'level-fall', entryId: hd.id, from: prev as Level, evidenceIds: v.evidenceIds, announce: W.fall(hd.id, prev as Level, v.added) });
        else changes.push({ type: 'level-rise', entryId: hd.id, from: prev, to: v.level, evidenceIds: v.evidenceIds, announce: W.rise(hd.id, prev, v.level, v.added) });
      });
    }
    const st = c.map.states[index] as MapStateDef;
    const pv = index === 0 ? null : (c.map.states[index - 1] as MapStateDef);
    const sig = (m: MapStateDef | null): string => (m === null ? '' : JSON.stringify([m.plate, m.area, m.shapes]));
    if (sig(st) !== sig(pv)) {
      if (!d.mapAnnounce) throw new Error(`${c.id}: step ${index} changes the map but has no mapAnnounce`);
      changes.push({ type: 'map', announce: d.mapAnnounce });
    }
    const first = exhibits[0];
    if (first) changes.push({ type: 'spotlight', exhibitId: first.id, announce: `Now examining: ${EXHIBIT_WORDS[first.kind]} ${first.refId}.` });
    return { index, stage: d.stage, id: `${c.id}-s${index}`, title: d.title, trigger: d.trigger, actionLabel: d.actionLabel, narrative, exhibits, changes };
  });

  const states: MapState[] = c.map.states.map((m, step) => {
    if (m.area !== null && c.map.areas[m.area] === undefined) throw new Error(`${c.id}: area ${m.area} has no size`);
    return {
      step,
      plate: m.plate,
      area: m.area === null ? null : { shapeId: m.area, areaKm2: c.map.areas[m.area] as number },
      shapes: m.shapes.map(([shapeId, style]) => ({ shapeId, style })),
      spotlightShapeId: m.spot,
      note: m.note,
    };
  });
  if (states.length !== steps.length) throw new Error(`${c.id}: ${states.length} map states for ${steps.length} steps`);

  const out: CaseFile = {
    simulated: true,
    id: c.id,
    code: c.code,
    title: c.title,
    lede: c.lede,
    window: c.window,
    meta: c.meta,
    entities: c.entities,
    charts: c.charts,
    sources: c.sources,
    independence: c.independence,
    rules: c.rules,
    indicators: c.indicators,
    evidenceItems: c.evidenceItems,
    claims,
    hypotheses,
    expectations: c.expectations,
    steps,
    map: { region: c.map.region, casePlate: c.map.casePlate, shapes: c.map.shapes, states },
    signoff: c.signoff,
    recipients: c.recipients,
    assessment: c.assessment,
    fieldSpecs: c.fieldSpecs,
    strip: c.strip,
    recordCounts: { scscf: c.records.scscf.length, ibcf: c.records.ibcf.length },
    records: c.records,
  };
  const { records: _records, ...rest } = out;
  out.glossary = glossaryFor(JSON.stringify(rest));
  return out;
}

