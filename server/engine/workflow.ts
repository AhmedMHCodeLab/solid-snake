// What releases each step. Step.trigger from the generator wins; until it fills every step, the trigger is
// derived from what the step brings: evidence returned by a new outside source is a collection in Evidence and a
// test in Test; anything else is released with the step before it.
import type { CaseFile, SourceCode, Step, StepTrigger } from '../../shared/types';

function newSources(c: CaseFile, step: Step): SourceCode[] {
  const seen = new Set<SourceCode>();
  const sourceOf = (kind: string, ref: string): SourceCode | undefined =>
    kind === 'evidence' ? c.evidenceItems.find((x) => x.id === ref)?.source : kind === 'indicator' ? c.indicators.find((x) => x.id === ref)?.source : undefined;
  for (const s of c.steps.slice(0, step.index)) for (const e of s.exhibits) { const src = sourceOf(e.kind, e.refId); if (src) seen.add(src); }
  const out: SourceCode[] = [];
  for (const e of step.exhibits) {
    const src = sourceOf(e.kind, e.refId);
    if (src && src !== 'E1' && !seen.has(src) && !out.includes(src)) out.push(src);
  }
  return out;
}

export function triggerOf(c: CaseFile, index: number): StepTrigger {
  const step = c.steps[index] as Step;
  if (step.trigger) return step.trigger;
  if (index === 0) return { kind: 'open' };
  const first = (stage: number) => c.steps.findIndex((s) => s.stage === stage) === index;
  const src = newSources(c, step);
  switch (step.stage) {
    case 2: return src[0] ? { kind: 'collect', source: src[0] } : { kind: 'auto' };
    case 3: return first(3) ? { kind: 'hypotheses' } : { kind: 'auto' };
    case 4: return src[0] ? { kind: 'test', source: src[0] } : { kind: 'auto' };
    case 5: return first(5) ? { kind: 'signoff' } : { kind: 'auto' };
    case 6: return first(6) && c.signoff.signableEntryId ? { kind: 'refer' } : { kind: 'auto' };
    case 7: return first(7) ? { kind: 'close' } : { kind: 'auto' };
    default: return { kind: 'auto' };
  }
}

export function actionLabelOf(c: CaseFile, index: number): string {
  const step = c.steps[index] as Step;
  if (step.actionLabel) return step.actionLabel;
  const t = triggerOf(c, index);
  const name = (s: SourceCode) => c.sources.find((x) => x.code === s)?.plainName ?? s;
  switch (t.kind) {
    case 'collect': return `Request ${name(t.source).toLowerCase()}`;
    case 'test': return `Request ${name(t.source).toLowerCase()}`;
    case 'hypotheses': return 'Record the competing explanations';
    case 'signoff': return 'Record the sign-off decision';
    case 'refer': return 'Disseminate the referral';
    case 'close': return 'Close the case';
    default: return 'Released with the step before it';
  }
}

/** Index of the step released by the analyst's sign-off decision. */
export const signoffIndex = (c: CaseFile): number => c.steps.findIndex((_, i) => triggerOf(c, i).kind === 'signoff');
/** Last step of the Test stage: test results are known once it is released. */
export const testStageEnd = (c: CaseFile): number => c.steps.reduce((m, s, i) => (s.stage <= 4 ? i : m), 0);
export const lastIndex = (c: CaseFile): number => c.steps.length - 1;
