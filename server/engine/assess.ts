// Recomputes the level of every claim and hypothesis from the evidence present in a released view (PRODUCT.md 2.4).
// It never reads a version's level: levels follow from the evidence, the rules, the baselines and the independence statements.
import type { Claim, Hypothesis, Indicator, Level, SourceCode } from '../../shared/types';

/** Sources outside the analytic chain: field survey, controlled test call, device recovery, operator or legal confirmation (PRODUCT.md 2.4, level 5). */
export const OUTSIDE_CHAIN: readonly SourceCode[] = ['E6'];

export interface AssessInput {
  claims: Claim[];
  hypotheses: Hypothesis[];
  indicators: Indicator[];
  evidenceItems: { id: string; source: SourceCode }[];
  independence: { id: string; pair: [SourceCode, SourceCode]; differentSystem: boolean; differentMethod: boolean; differentCollectionPoint: boolean; statement: string }[];
  rules: { id: string }[];
}

export interface Assessed {
  entryId: string;
  level: Level | null;
  /** What the evidence showed that the rules flag, for example an open hypothesis whose rivals have all fallen. */
  issues: string[];
}

/** recordSource answers E1 or E2 for a record id present in the case, and undefined for anything else. */
export function assess(v: AssessInput, recordSource: (id: string) => SourceCode | undefined): Assessed[] {
  const ind = new Map(v.indicators.map((x) => [x.id, x]));
  const items = new Map(v.evidenceItems.map((x) => [x.id, x]));
  const rules = new Set(v.rules.map((r) => r.id));
  const indep = new Map(v.independence.map((x) => [x.id, x]));
  const sourceOf = (id: string): SourceCode | undefined => ind.get(id)?.source ?? items.get(id)?.source ?? recordSource(id);
  const present = (id: string): boolean => sourceOf(id) !== undefined;

  const claimLevel = (c: Claim): Assessed => {
    const issues: string[] = [];
    const ev = new Set(c.versions.flatMap((x) => x.evidenceIds));
    const sources = new Set([...ev].map(sourceOf).filter((s): s is SourceCode => s !== undefined));
    if ([...ev].some((id) => !present(id))) issues.push('evidence-not-present');
    const l1 = [...ev].some((id) => recordSource(id) !== undefined || items.has(id));
    const l2 = [...ev].some((id) => {
      const i = ind.get(id);
      return !!i && rules.has(i.ruleId) && Number.isFinite(i.baseline.value) && i.baseline.description.length > 0 && i.recordIds.length > 0;
    });
    const l3 = c.versions.some((x) => {
      const s = x.independenceId ? indep.get(x.independenceId) : undefined;
      return !!s && s.pair[0] !== s.pair[1] && sources.has(s.pair[0]) && sources.has(s.pair[1]) && (s.differentSystem || s.differentMethod || s.differentCollectionPoint) && s.statement.length > 0;
    });
    return { entryId: c.id, level: l3 ? 3 : l2 ? 2 : l1 ? 1 : null, issues };
  };

  const claims = v.claims.map(claimLevel);
  const claimMap = new Map(claims.map((x) => [x.entryId, x]));
  const formulated = new Set(v.hypotheses.filter((h) => h.versions.length > 0).map((h) => h.id));

  // Two passes: whether a rival is open depends on its own refutation, which needs no rival.
  const state = (h: Hypothesis): 'open' | 'verified' | 'fallen' | null => {
    const last = h.versions[h.versions.length - 1];
    if (!last) return null;
    const ev = last.evidenceIds;
    if (last.state === 'fallen') return ev.length > 0 && ev.every(present) ? 'fallen' : 'open';
    if (last.state === 'verified') return ev.some((id) => items.has(id) && OUTSIDE_CHAIN.includes((items.get(id) as { source: SourceCode }).source)) ? 'verified' : 'open';
    return 'open';
  };
  const states = new Map(v.hypotheses.map((h) => [h.id, state(h)]));

  const hyps = v.hypotheses.map((h): Assessed => {
    const issues: string[] = [];
    const last = h.versions[h.versions.length - 1];
    const s = states.get(h.id);
    if (!last || !s) return { entryId: h.id, level: null, issues };
    if (last.state === 'verified' && s !== 'verified') issues.push('verified-without-outside-source');
    if (last.state === 'fallen' && s !== 'fallen') issues.push('fallen-without-evidence');
    if (s === 'fallen') return { entryId: h.id, level: null, issues };
    if (s === 'verified') return { entryId: h.id, level: 5, issues };
    const cites = h.cites.some((id) => (claimMap.get(id)?.level ?? null) !== null);
    const rivals = h.rivals.filter((r) => formulated.has(r));
    if (!cites || rivals.length === 0 || !h.support || !h.refute) return { entryId: h.id, level: null, issues: [...issues, 'not-formulated'] };
    if (!rivals.some((r) => states.get(r) === 'open')) issues.push('no-open-rival');
    return { entryId: h.id, level: 4, issues };
  });
  return [...claims, ...hyps];
}

export const levelMap = (a: Assessed[]): Map<string, Level | null> => new Map(a.map((x) => [x.entryId, x.level]));
