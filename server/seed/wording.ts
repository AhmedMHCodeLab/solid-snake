// Level templates from PRODUCT.md 2.4. Every claim and hypothesis statement is generated here.
// The reserved words (confirmed, fraudster, caught, perpetrator) are never produced below level 5.
import type { Level } from '../../shared/types';

export type Pos = 'above' | 'below' | 'within';
const POS: Record<Pos, string> = { above: 'above', below: 'below', within: 'within the range of' };

export const W = {
  /** Level 1: a record or an evidence item exists with these values. */
  l1: (src: string, fact: string): string => `Observed in ${src}: ${fact}.`,

  /** Level 2: a reproducible measure against a stated baseline. Never a probability. */
  l2: (indicatorId: string, measure: string, pos: Pos, baselineId: string, population: string, window: string): string =>
    `Analytical indicator ${indicatorId}: ${measure} is ${POS[pos]} baseline ${baselineId} (${population}; ${window}). This is an ordering, not a probability.`,

  /** Level 3: two sources point the same way. The independence statement is shown beside it. */
  l3: (a: string, b: string, what: string): string => `Correlated evidence: ${a} and ${b} both indicate ${what}. This does not make the explanation unique.`,

  /** Level 4: a named explanation, its alternatives, what would support or refute it. */
  l4: (id: string, name: string, alternatives: string[], test: string): string =>
    `Hypothesis ${id}, ${name}. Alternatives: ${alternatives.join('; ')}. Test: it would be ${test} Not established.`,

  /** Level 5: only in simulated context. */
  l5: (fact: string): string => `Verified (simulated): ${fact}.`,

  fell: (id: string, name: string, why: string): string => `Hypothesis ${id}, ${name}, no longer holds: ${why}.`,

  rise: (id: string, from: Level | null, to: Level, added: string): string =>
    from === null ? `${id} entered at level ${to}: ${added}.` : `${id} rose from level ${from} to level ${to}: ${added}.`,

  fall: (id: string, from: Level, why: string): string => `${id} fell from level ${from}: ${why}.`,
};
