// The case as released to one step. Nothing after the step is served: later steps, versions, map states,
// expectations, evidence, charts, test results, the sign-off outcome and the assessment.
import type { AnyRecord, Assessment, CaseFile, CaseSummary, SourceCode } from '../../shared/types';
import { assess, levelMap } from './assess';
import type { Assessed } from './assess';
import { lastIndex, signoffIndex, testStageEnd, triggerOf } from './workflow';

export type ReleasedView = Omit<CaseSummary, 'assessment'> & {
  /** The assessment is part of the outcome: null until the last step is released. */
  assessment: Assessment | null;
  releasedStep: number;
};

const recordIndex = new WeakMap<CaseFile, Map<string, AnyRecord>>();
export function recordsOf(c: CaseFile): Map<string, AnyRecord> {
  let m = recordIndex.get(c);
  if (!m) {
    m = new Map([...c.records.scscf, ...c.records.ibcf].map((x) => [x.id, x]));
    recordIndex.set(c, m);
  }
  return m;
}
export const recordSourceOf = (c: CaseFile) => (id: string): SourceCode | undefined => {
  const r = recordsOf(c).get(id);
  return r ? (r.recordType === 'sCSCFRecord' ? 'E1' : 'E2') : undefined;
};

/**
 * sealed: the supervisor has countersigned the current analyst signature. The seal shape and the step announcement that
 * draws it are released only then, so a promote that a supervisor has not yet countersigned (or has returned) shows no seal.
 */
export function release(c: CaseFile, step: number, opts: { sealed?: boolean } = {}): ReleasedView {
  const sealed = opts.sealed ?? true;
  const sealIds = new Set(c.map.shapes.filter((x) => x.kind === 'seal').map((x) => x.id));
  const sealedAt = new Set(c.map.states.filter((st) => st.shapes.some((x) => sealIds.has(x.shapeId))).map((st) => st.step));
  const steps = c.steps
    .filter((s) => s.index <= step)
    .map((s) => (sealed || !sealedAt.has(s.index) ? s : { ...s, changes: s.changes.filter((ch) => ch.type !== 'map') }));
  const exhibits = steps.flatMap((s) => s.exhibits);
  const shown = (kind: string) => new Set(exhibits.filter((e) => e.kind === kind).map((e) => e.refId));

  const testsKnown = step >= testStageEnd(c);
  let claims = c.claims.map((x) => ({ ...x, versions: x.versions.filter((v) => v.step <= step) })).filter((x) => x.versions.length > 0);
  let hypotheses = c.hypotheses
    .map((h) => ({ ...h, versions: h.versions.filter((v) => v.step <= step), tests: h.tests.map((t) => ({ ...t, status: testsKnown ? t.status : ('requested' as const) })) }))
    .filter((h) => h.versions.length > 0);
  let expectations = c.expectations.map((x) => ({ ...x, timeline: x.timeline.filter((t) => t.step <= step) })).filter((x) => x.timeline.length > 0);

  const claimIds = new Set(claims.map((x) => x.id));
  const hypIds = new Set(hypotheses.map((x) => x.id));
  const expIds = new Set(expectations.map((x) => x.id));
  claims = claims.map((x) => ({ ...x, limitedBy: x.limitedBy.filter((id) => expIds.has(id)) }));
  hypotheses = hypotheses.map((h) => ({ ...h, cites: h.cites.filter((id) => claimIds.has(id)), rivals: h.rivals.filter((id) => hypIds.has(id)) }));
  expectations = expectations.map((x) => ({ ...x, limits: x.limits.filter((id) => claimIds.has(id) || hypIds.has(id)) }));

  const cited = new Set([...claims.flatMap((x) => x.versions.flatMap((v) => v.evidenceIds)), ...hypotheses.flatMap((h) => h.versions.flatMap((v) => v.evidenceIds))]);
  const indicators = c.indicators.filter((i) => cited.has(i.id) || shown('indicator').has(i.id));
  const evidenceItems = c.evidenceItems.filter((i) => cited.has(i.id) || shown('evidence').has(i.id));
  const independence = c.independence.filter((i) => claims.some((x) => x.versions.some((v) => v.independenceId === i.id)));
  const charts = (c.charts ?? []).filter((ch) => shown('chart').has(ch.id) || claims.some((x) => x.id === ch.entryId && x.versions.some((v) => v.ruleId === ch.ruleId)));

  const states = c.map.states.filter((s) => s.step <= step).map((s) => (sealed ? s : { ...s, shapes: s.shapes.filter((x) => !sealIds.has(x.shapeId)) }));
  const shapeIds = new Set([...(c.map.region ? [c.map.region.shapeId] : []), ...states.flatMap((s) => [...(s.area ? [s.area.shapeId] : []), ...s.shapes.map((x) => x.shapeId)])]);
  const map = { ...c.map, states, shapes: c.map.shapes.filter((s) => shapeIds.has(s.id)) };

  const base = { indicators, evidenceItems, independence, claims, hypotheses, rules: c.rules };
  const levels = levelMap(assess(base, recordSourceOf(c)));
  const atSignoff = step >= signoffIndex(c) - 1;
  const signable = [...levels].find(([, l]) => l === 5)?.[0] ?? null;
  const released = new Set([...claimIds, ...hypIds]);
  const signoff = {
    signableEntryId: signable,
    openEntries: atSignoff
      ? [...levels]
          .filter(([, l]) => l !== 5)
          .map(([entryId, level]) => ({ entryId, level, lacks: c.signoff.openEntries.find((o) => o.entryId === entryId)?.lacks ?? (level === null ? 'An explanation that still holds on the evidence: it fell.' : 'A result from outside the analytic chain.') }))
      : [],
    reasonCodes: c.signoff.reasonCodes
      .map((r) => ({ ...r, entryIds: r.entryIds.filter((id) => released.has(id) && (!r.actions.includes('promote') || levels.get(id) === 5)) }))
      .filter((r) => r.entryIds.length > 0),
    supervisorChecks: c.signoff.supervisorChecks,
  };

  // Sources and glossary terms are released with the step that first uses them, never before.
  const used = new Set<SourceCode>(['E1']);
  for (const x of claims) for (const v of x.versions) for (const code of v.sources) used.add(code);
  for (const i of indicators) used.add(i.source);
  for (const i of evidenceItems) used.add(i.source);
  for (const x of expectations) used.add(x.fromSource);
  for (const st of steps) {
    const t = triggerOf(c, st.index);
    if (t.kind === 'collect' || t.kind === 'test') used.add(t.source);
  }
  const sources = c.sources.filter((x) => used.has(x.code));
  const { records: _records, assessment, entities, glossary, ...rest } = c;
  void _records;
  const view: ReleasedView = {
    ...rest,
    sources,
    steps,
    claims,
    hypotheses,
    expectations,
    indicators,
    evidenceItems,
    independence,
    charts,
    map,
    signoff,
    assessment: step >= lastIndex(c) ? assessment : null,
    releasedStep: step,
  };
  if (entities) {
    const text = JSON.stringify(view);
    view.entities = entities.filter((e) => text.includes(e.id));
  }
  if (glossary) {
    const spoken = JSON.stringify({ title: view.title, lede: view.lede, meta: view.meta, sources, steps, claims, hypotheses, indicators, evidenceItems, expectations, charts: view.charts, shapes: map.shapes.map((x) => x.label) });
    const re = (t: string) => new RegExp(`(^|[^A-Za-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`, 'i');
    view.glossary = glossary.filter((g) => re(g.term).test(spoken));
  }
  return view;
}

export function assessView(c: CaseFile, view: ReleasedView): Assessed[] {
  return assess(view, recordSourceOf(c));
}

/** Records the released view names: by claim versions, indicators, record exhibits and charts. */
export function releasedRecordIds(c: CaseFile, view: ReleasedView): Set<string> {
  const idx = recordsOf(c);
  const out = new Set<string>();
  for (const x of view.claims) for (const v of x.versions) for (const id of v.evidenceIds) if (idx.has(id)) out.add(id);
  for (const i of view.indicators) for (const id of i.recordIds) out.add(id);
  for (const s of view.steps) for (const e of s.exhibits) if (e.kind === 'records' && idx.has(e.refId)) out.add(e.refId);
  for (const ch of view.charts ?? []) for (const id of ch.recordIds) out.add(id);
  return out;
}
