// assess() recomputes levels from released evidence. It must equal levelAt(entry, step) from the generated data.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assess } from '../../server/engine/assess';
import { CASE_IDS, loadCases } from '../../server/engine/feed';
import { assessView, recordSourceOf, release } from '../../server/engine/release';
import { levelAt } from '../../shared/types';

const cases = loadCases(join(process.cwd(), 'data', 'generated'));

describe('assess() against the scenario data', () => {
  for (const id of CASE_IDS) {
    it(`case ${id}: every entry at every step`, () => {
      const c = cases[id];
      const disagreements: string[] = [];
      const issues: string[] = [];
      for (let s = 0; s < c.steps.length; s++) {
        const got = new Map(assessView(c, release(c, s)).map((x) => [x.entryId, x]));
        for (const e of [...c.claims, ...c.hypotheses]) {
          const a = got.get(e.id);
          const want = levelAt(e, s);
          if ((a?.level ?? null) !== want) disagreements.push(`step ${s} ${e.id}: assess ${a?.level ?? null}, data ${want}`);
          if (a?.issues.length) issues.push(`step ${s} ${e.id}: ${a.issues.join(',')}`);
        }
      }
      if (issues.length) console.log(`case ${id} flagged: ${issues.join('; ')}`);
      expect(disagreements).toEqual([]);
    });
  }

  it('flags an open hypothesis whose rivals have all fallen (case c, H-C2) without changing its level', () => {
    const c = cases.c;
    const last = c.steps.length - 1;
    const h = assessView(c, release(c, last)).find((x) => x.entryId === 'H-C2');
    expect(h).toEqual({ entryId: 'H-C2', level: 4, issues: ['no-open-rival'] });
  });
});

describe('assess() follows the evidence, not the stated level', () => {
  const a = cases.a;
  const view = release(a, a.steps.length - 1);
  const src = recordSourceOf(a);

  it('a verified hypothesis without its outside-chain item stays at level 4', () => {
    const v = { ...view, evidenceItems: view.evidenceItems.filter((x) => x.source !== 'E6') };
    const h = assess(v, src).find((x) => x.entryId === a.signoff.signableEntryId);
    expect(h?.level).toBe(4);
    expect(h?.issues).toContain('verified-without-outside-source');
  });

  it('a level 3 claim without its independence statement drops to level 2', () => {
    const l3 = view.claims.find((x) => x.versions.some((v) => v.level === 3)) as (typeof view.claims)[number];
    const got = assess({ ...view, independence: [] }, src).find((x) => x.entryId === l3.id);
    expect(got?.level).toBe(2);
  });

  it('a level 2 claim without its indicator drops to level 1', () => {
    const got = assess({ ...view, indicators: [], independence: [] }, src).find((x) => x.entryId === view.claims[0]?.id);
    expect(got?.level).toBe(1);
  });
});
