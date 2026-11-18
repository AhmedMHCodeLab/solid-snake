// The compact client model embedded in a case page, and the pure state functions of the state layer.
// It carries no records array: evidence id lists are cut to a few ids plus a count.
import { levelAt, type CaseSummary, type Entry, type Expectation, type Level, type MapShape, type MapState } from '../../../shared/types';

const CUT = 6;
const cut = (ids: string[]) => ({ evidence: ids.slice(0, CUT), evidenceCount: ids.length });

export interface ModelVersion { step: number; level: Level | null; state?: 'open' | 'verified' | 'fallen'; statement: string; evidence: string[]; evidenceCount: number; ruleId?: string; independenceId?: string; sources?: string[] }
export interface ModelEntry { id: string; kind: 'evidence' | 'hypothesis'; title: string; versions: ModelVersion[]; cites?: string[]; rivals?: string[]; limitedBy?: string[]; footprint?: string; server?: { level: Level | null; issues: string[] } }

/** levels: the server's recomputed levels for the released step. Where present they are the levels shown. */
export function buildModel(c: Omit<CaseSummary, 'assessment' | 'id' | 'code'> & { id?: string; code?: string }, levels?: { entryId: string; level: Level | null; issues: string[] }[], history?: Record<string, Record<string, Level | null>>) {
  const model = buildBase(c);
  for (const l of levels ?? []) { const e = model.entries.find((x) => x.id === l.entryId); if (e) e.server = { level: l.level, issues: l.issues }; }
  // Each version of an entry shows the level the platform recomputed at that step, not the level written in the case data.
  if (history) for (const e of model.entries) for (const v of e.versions) { const at = history[v.step]; if (at && e.id in at) v.level = at[e.id] as Level | null; }
  return model;
}
function buildBase(c: Omit<CaseSummary, 'assessment' | 'id' | 'code'> & { id?: string; code?: string }) {
  const entries: ModelEntry[] = [
    ...c.claims.map((e) => ({ id: e.id, kind: 'evidence' as const, title: e.subject, limitedBy: e.limitedBy, versions: e.versions.map((v) => ({ step: v.step, level: v.level, statement: v.statement, ...cut(v.evidenceIds), ruleId: v.ruleId, independenceId: v.independenceId, sources: v.sources })) })),
    ...c.hypotheses.map((h) => ({ id: h.id, kind: 'hypothesis' as const, title: h.name, cites: h.cites, rivals: h.rivals, footprint: h.footprintShapeId, versions: h.versions.map((v) => ({ step: v.step, level: v.level, state: v.state, statement: v.statement, ...cut(v.evidenceIds) })) })),
  ];
  return {
    id: c.id ?? '',
    code: c.code ?? '',
    title: c.title,
    window: c.window,
    entities: c.entities ?? [],
    glossary: c.glossary ?? [],
    sources: c.sources.map((s) => ({ code: s.code, name: s.name, plainName: s.plainName, basis: s.basis })),
    rules: c.rules.map((r) => ({ id: r.id, name: r.name, basis: r.basis })),
    independence: c.independence.map((i) => ({ id: i.id, statement: i.statement })),
    entries,
    expectations: c.expectations,
    steps: c.steps.map((s) => ({ index: s.index, stage: s.stage, id: s.id, title: s.title, changes: s.changes, exhibits: s.exhibits.map((e) => ({ id: e.id, kind: e.kind, refId: e.refId })) })),
    map: { region: c.map.region, casePlate: { widthKm: c.map.casePlate.widthKm, heightKm: c.map.casePlate.heightKm, sectors: c.map.casePlate.sectors }, shapes: c.map.shapes, states: c.map.states },
  };
}
export type Model = ReturnType<typeof buildBase>;

/** levelAt from shared/types, applied to the cut-down entry (same fields it reads). */
export const entryLevel = (e: ModelEntry, step: number): Level | null => levelAt(e as unknown as Entry, step);

export type EntryStatus =
  | { kind: 'absent' }
  | { kind: 'current'; level: Level; version: ModelVersion; from: Level | null }
  | { kind: 'fallen'; was: Level; version: ModelVersion };

/** Where an entry stands at a step. Step -1 is the case cover, before any record has entered. */
export function entryStatus(e: ModelEntry, step: number): EntryStatus {
  const vs = e.versions.filter((v) => v.step <= step);
  const cur = vs[vs.length - 1];
  if (!cur) return { kind: 'absent' };
  const latest = e.versions.length && step >= e.versions[e.versions.length - 1]!.step;
  const fromServer = e.server && latest;
  if (e.kind === 'hypothesis' && (fromServer ? e.server!.level === null : cur.state === 'fallen')) {
    const prev = [...vs].reverse().find((v) => v.level !== null);
    return { kind: 'fallen', was: (prev?.level ?? 4) as Level, version: cur };
  }
  const lvl = fromServer ? e.server!.level : entryLevel(e, step);
  if (lvl === null) return { kind: 'absent' };
  const prev = vs.length > 1 ? vs[vs.length - 2]!.level : null;
  return { kind: 'current', level: lvl, version: cur, from: prev };
}

export type GapState = 'none' | 'not-observed' | 'observed' | 'withdrawn';
export function gapState(x: Expectation, step: number): GapState {
  let s: GapState = 'none';
  for (const t of x.timeline) if (t.step <= step) s = t.state;
  return s;
}

/** Map state for a step; the cover (-1) uses step 0's plate with no light. */
export function mapStateAt(m: Model, step: number): MapState | undefined {
  const s = Math.max(0, Math.min(step, m.map.states.length - 1));
  return m.map.states.find((x) => x.step === s) ?? m.map.states[s];
}
export const shapeById = (m: Model, id: string | null | undefined): MapShape | undefined => (id ? m.map.shapes.find((s) => s.id === id) : undefined);

/** Every entry bound to the current state's areas, for the "Areas on this plate" list. */
export function areasOn(m: Model, step: number): { shape: MapShape; role: 'area' | 'shape'; style: string }[] {
  const st = mapStateAt(m, step);
  if (!st || step < 0) return [];
  const out: { shape: MapShape; role: 'area' | 'shape'; style: string }[] = [];
  const a = shapeById(m, st.area?.shapeId);
  if (a) out.push({ shape: a, role: 'area', style: 'area' });
  for (const s of st.shapes) {
    const sh = shapeById(m, s.shapeId);
    if (sh && s.style !== 'dissolved' && sh.id !== a?.id) out.push({ shape: sh, role: 'shape', style: s.style });
  }
  return out;
}
