// Every level the interface draws comes from the platform's own recomputation (the `levels` list and its per-step history
// in the case response), never from the level written in the case data. The authored levels are scrambled here, so a
// renderer that still read them would draw the wrong level and fail.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASE_IDS, loadCases } from '../../server/engine/feed';
import { levelMap } from '../../server/engine/assess';
import { assessView, release } from '../../server/engine/release';
import type { ReleasedView } from '../../server/engine/release';
import { registerHTML } from '../../web/src/render/register';
import { buildModel } from '../../web/src/render/model';
import { stepHTML } from '../../web/src/render/exhibits';
import type { Level } from '../../shared/types';

const cases = loadCases(join(process.cwd(), 'data', 'generated'));

/** The case view with every authored level made wrong on purpose. */
function scrambled(v: ReleasedView): ReleasedView {
  const wrong = (l: number | null): Level | null => (l === null ? null : ((l % 5) + 1) as Level);
  return {
    ...v,
    claims: v.claims.map((c) => ({ ...c, versions: c.versions.map((x) => ({ ...x, level: wrong(x.level) as 1 | 2 | 3 })) })),
    hypotheses: v.hypotheses.map((h) => ({ ...h, versions: h.versions.map((x) => ({ ...x, level: wrong(x.level) as 4 | 5 | null })) })),
    steps: v.steps.map((s) => ({
      ...s,
      narrative: s.narrative.map((b) => (b.kind === 'claim' ? { ...b, level: wrong(b.level) as Level } : b)),
      exhibits: s.exhibits.map((e) => ({ ...e, label: { ...e.label, level: wrong(e.label.level) } })),
    })),
  };
}

describe.each(CASE_IDS)('case %s: displayed levels equal the platform levels', (id) => {
  const c = cases[id];
  const history: Record<string, Record<string, Level | null>> = {};
  for (let i = 0; i < c.steps.length; i++) history[i] = Object.fromEntries(levelMap(assessView(c, release(c, i))));

  for (let s = 0; s < c.steps.length; s++) {
    it(`step ${s}: claim blocks and exhibit cards`, () => {
      const v = release(c, s);
      const view = { ...scrambled(v), serverLevels: history };
      const html = stepHTML(view, view.steps[s]!, true, `t${s}`);
      const blocks = [...html.matchAll(/data-claim="([^"]+)" data-level="(\d)"/g)];
      for (const [, entry, level] of blocks) expect(Number(level), `${entry} claim block`).toBe(history[s]![entry!]);
      const shown = [...html.matchAll(/<span class="claim__level">Level (\d), /g)].map((m) => Number(m[1]));
      expect(shown).toEqual(blocks.map((m) => Number(m[2])));
      for (const m of html.matchAll(/data-bound="([^"]+)"( data-level="(\d)")?( data-fallen="true")?/g)) {
        const server = history[s]![m[1]!] as Level | null;
        if (m[4]) expect(server, `${m[1]} fallen card`).toBeNull();
        else if (m[3]) expect(Number(m[3]), `${m[1]} card`).toBe(server);
        else expect(server, `${m[1]} card without a level`).toBeNull();
      }
    });
  }

  it('the register places every entry under the level the platform computed, and each version heading shows the platform level', () => {
    const last = c.steps.length - 1;
    const v = release(c, last);
    const levels = assessView(c, v);
    const model = buildModel(scrambled(v), levels, history);
    const html = registerHTML(model, last, 'reg');
    const byLevel = new Map<string, string>();
    for (const g of html.split('<div role="group" class="register').slice(1)) {
      const level = /data-level="(\d)"/.exec(g)?.[1] ?? (g.includes('register--fallen') ? 'fallen' : g.includes('register--lacuna') ? 'gaps' : '?');
      for (const m of g.matchAll(/data-entry="([^"]+)"/g)) byLevel.set(m[1]!, level);
    }
    for (const l of levels) {
      const placed = byLevel.get(l.entryId);
      if (l.level === null) expect(['fallen', undefined], l.entryId).toContain(placed);
      else expect(placed, l.entryId).toBe(String(l.level));
    }
  });
});

describe('the level checks have something to check', () => {
  it('claim blocks and bound cards exist, and the authored levels really were scrambled', () => {
    const c = cases.a;
    const v = release(c, c.steps.length - 1);
    const view = { ...scrambled(v), serverLevels: Object.fromEntries(c.steps.map((_, i) => [i, Object.fromEntries(levelMap(assessView(c, release(c, i))))])) };
    const html = c.steps.map((s) => stepHTML(view, view.steps[s.index]!, true, `n${s.index}`)).join('');
    expect([...html.matchAll(/data-claim="/g)].length).toBeGreaterThan(10);
    expect([...html.matchAll(/data-bound="/g)].length).toBeGreaterThan(10);
    expect(view.claims[0]!.versions[0]!.level).not.toBe(c.claims[0]!.versions[0]!.level);
  });
});
