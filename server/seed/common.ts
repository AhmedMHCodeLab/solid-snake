// Pieces shared by the four case files.
import type { AnyRecord, Indicator, Level, RecipientRole, ScscfRecord, SignAction, SignoffSpec, SourceCode, StageId } from '../../shared/types';
import { RULE_FN } from './rules';
import type { Pos } from './wording';
import { RECIPIENTS } from './sources';
import { cl, ctx, lim } from './builder';
import type { BlockDef, MapStateDef, StepDef } from './builder';
import { endIso, WINDOW_STARTS } from './records';
import { r } from './prng';

export const ids = (recs: AnyRecord[]): string[] => recs.map((x) => x.id);
export const winOf = (L: string): { start: string; end: string } => ({ start: WINDOW_STARTS[L] as string, end: endIso(L) });
export const WINDOW_TEXT = '72-hour window';

/** A sort key only: the words used on screen for where a value sits against its baseline. */
export function posOf(value: number, base: number): Pos {
  return value > base * 1.25 ? 'above' : value < base * 0.8 ? 'below' : 'within';
}

export function indicator(p: {
  L: string;
  id: string;
  ruleId: string;
  source: SourceCode;
  description: string;
  unit: string;
  recs: AnyRecord[];
  baseline: { id: string; description: string; value: number; population: string };
  ruleBaseline?: number;
}): Indicator {
  const value = (RULE_FN[p.ruleId] as (recs: AnyRecord[], c: { baseline: number }) => number)(p.recs, { baseline: p.ruleBaseline ?? p.baseline.value });
  return {
    id: p.id,
    ruleId: p.ruleId,
    source: p.source,
    description: p.description,
    value,
    unit: p.unit,
    baseline: p.baseline,
    window: winOf(p.L),
    position: p.ruleId === 'R-2' ? posOf(value, 1) : posOf(value, p.baseline.value),
    recordIds: ids(p.recs),
  };
}

export const mean1 = (recs: ScscfRecord[], rule: string): number => r((RULE_FN[rule] as (x: AnyRecord[], c: { baseline: number }) => number)(recs, { baseline: 1 }), 1);

export const SUPERVISOR_CHECKS: SignoffSpec['supervisorChecks'] = [
  { id: 'SC-1', label: 'The entry is at level 5.' },
  { id: 'SC-2', label: 'An analyst promote with a prepared reason exists for the entry.' },
  { id: 'SC-3', label: 'The "not established" list is complete.' },
];

export function reasonCodes(signable: string | null, openIds: string[], extra: SignoffSpec['reasonCodes'] = [], fallenIds: string[] = []): SignoffSpec['reasonCodes'] {
  const out: SignoffSpec['reasonCodes'] = [];
  if (signable) out.push({ code: 'RC-PROMOTE-VERIFIED', label: 'Verified by independent evidence from outside the analysis (simulated).', actions: ['promote'] as SignAction[], entryIds: [signable] });
  const all = signable ? [signable, ...openIds] : openIds;
  out.push(...extra);
  out.push({ code: 'RC-HOLD-AWAITING', label: 'Evidence that was requested has not returned.', actions: ['hold'], entryIds: all });
  out.push({ code: 'RC-HOLD-RIVALS', label: 'An innocent explanation is still open at the same level.', actions: ['hold'], entryIds: all });
  out.push({ code: 'RC-REJECT-UNSUPPORTED', label: 'The evidence does not support this entry at its present level.', actions: ['reject'], entryIds: all });
  out.push({ code: 'RC-REJECT-WEAK-LINK', label: 'The entry rests on a correlation whose independence is weak.', actions: ['reject'], entryIds: all });
  if (fallenIds.length > 0) {
    out.push({ code: 'RC-HOLD-FALLEN', label: 'Keep the fallen explanation on record until the evidence that contradicted it has been reviewed.', actions: ['hold'], entryIds: fallenIds });
    out.push({ code: 'RC-REJECT-FALLEN', label: 'Accept that the evidence no longer supports this explanation.', actions: ['reject'], entryIds: fallenIds });
  }
  return out;
}

export { RECIPIENTS };
export type { RecipientRole };

/** Map states that do not change between steps. */
export const hold = (m: MapStateDef, note?: string, spot: string | null = null): MapStateDef => ({ ...m, spot, note: note ?? m.note });

export const ASSESSMENT_NOTE = 'PROPOSAL: DECISIONS.md section 6 (O2, DC-13 reading a). Nothing an analyst records moves a level.';

/** Sign-off, referral and outcome steps for a case in which nothing can be signed. */
export function unsignableSteps(p: {
  firstIndex: number;
  assessRef: string;
  signBlocks: BlockDef[];
  openText: string;
  outcomeBlocks: BlockDef[];
  notEstablished: string;
}): StepDef[] {
  return [
    {
      stage: 5 as StageId,
      title: 'Nothing can be signed',
      trigger: { kind: 'signoff' },
      actionLabel: 'Record an assessment',
      blocks: [
        ...p.signBlocks,
        ctx('Only an entry at level 5 can be signed. Below level 5 the analyst may record an assessment, hold or reject, each with a prepared reason. An assessment is not a signature.', 'PROPOSAL', ASSESSMENT_NOTE),
        lim(p.openText),
      ],
      exhibits: [{ kind: 'assessment', refId: p.assessRef }],
    },
    {
      stage: 6 as StageId,
      title: 'No referral',
      trigger: { kind: 'auto' },
      actionLabel: 'Check referral options',
      blocks: [
        ctx('A referral exists only for a signed level 5 finding. This case has no packet and no recipients. The recipient roles on this platform are simulated, and who would act on a finding in reality is not established.', 'FICTION', 'FICTION: the four recipient roles are a simulated chain (DIRECTION-CHANGE-001; DECISIONS.md section 6).'),
        lim('Nothing is sent, and nothing in this case supports sending.'),
      ],
      exhibits: [{ kind: 'assessment', refId: p.assessRef }],
    },
    {
      stage: 7 as StageId,
      title: 'Outcome: an assessment record',
      trigger: { kind: 'close' },
      actionLabel: 'Close the case with an assessment record',
      blocks: [
        ...p.outcomeBlocks,
        ctx('The closing assessment lists what was established, what is only suggested and what was not established. It records the reasoning. It is not a verdict.', 'PROPOSAL', 'PROPOSAL: PRODUCT.md Part 5, Assessment; the case closes without a conclusion that the evidence does not carry.'),
        lim(p.notEstablished),
      ],
      exhibits: [{ kind: 'assessment', refId: p.assessRef }],
    },
  ];
}

export const lvl = (n: Level): string => `level ${n}`;
export { cl, ctx, lim };

import type { Gen } from './records';
import { startMs } from './records';

/** Strip data: one lane per SIM of interest, one tick per originating record. Duration -1 means no release time stamp. */
export function stripOf(L: string, g: Gen): { lanes: string[]; ticks: [number, number, number, string][] } {
  const lanes = g.groupSubIds.slice().sort();
  const laneOf = new Map(g.groupUris.map((u, i) => [u, lanes.indexOf(g.groupSubIds[i] as string)] as const));
  const t0 = startMs(L);
  const ticks: [number, number, number, string][] = g.gOrig.map((x) => {
    const start = Date.parse(x.serviceDeliveryStartTimeStamp);
    const end = x.serviceDeliveryEndTimeStamp ? Date.parse(x.serviceDeliveryEndTimeStamp) : null;
    return [Math.round((start - t0) / 60000), laneOf.get(x.listOfCallingPartyAddress) as number, end === null ? -1 : Math.round((end - start) / 1000), x.id];
  });
  return { lanes, ticks };
}
