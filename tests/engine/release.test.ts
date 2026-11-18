// release(file, step) serves nothing from after the step.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CASE_IDS, loadCases } from '../../server/engine/feed';
import { release } from '../../server/engine/release';
import { lastIndex, signoffIndex, testStageEnd } from '../../server/engine/workflow';
import type { CaseFile } from '../../shared/types';

const cases = loadCases(join(process.cwd(), 'data', 'generated'));

/** The step at which an id is first shown or cited, from the full file. */
function firstStep(c: CaseFile): Map<string, number> {
  const out = new Map<string, number>();
  const note = (id: string, s: number) => { if (!out.has(id) || (out.get(id) as number) > s) out.set(id, s); };
  for (const st of c.steps) for (const e of st.exhibits) note(e.refId, st.index);
  for (const e of [...c.claims, ...c.hypotheses]) for (const v of e.versions as { step: number; evidenceIds: string[] }[]) { note(e.id, v.step); for (const id of v.evidenceIds) note(id, v.step); }
  for (const x of c.expectations) note(x.id, Math.min(...x.timeline.map((t) => t.step)));
  for (const x of c.claims) for (const v of x.versions) if (v.independenceId) note(v.independenceId, v.step);
  return out;
}

describe.each(CASE_IDS)('release, case %s', (id) => {
  const c = cases[id];
  const first = firstStep(c);
  const later = (s: number) => [...first].filter(([, at]) => at > s).map(([k]) => k);
  // ids that only appear later and are distinctive enough to search the JSON for
  const distinctive = (s: number) => later(s).filter((k) => /^(EVI|EXP|IND|CH|H)-/.test(k) || c.indicators.some((i) => i.id === k));

  for (let s = 0; s < c.steps.length; s++) {
    it(`step ${s}: nothing later is served`, () => {
      const v = release(c, s);
      const textOf = JSON.stringify({ ...v, rules: [], signoff: { ...v.signoff, supervisorChecks: [] }, strip: null, glossary: [] });
      expect(v.steps.map((x) => x.index)).toEqual(c.steps.filter((x) => x.index <= s).map((x) => x.index));
      for (const e of [...v.claims, ...v.hypotheses]) for (const ver of e.versions) expect(ver.step).toBeLessThanOrEqual(s);
      for (const m of v.map.states) expect(m.step).toBeLessThanOrEqual(s);
      for (const x of v.expectations) for (const t of x.timeline) expect(t.step).toBeLessThanOrEqual(s);
      for (const k of distinctive(s)) expect(textOf, `${k} leaks at step ${s}`).not.toMatch(new RegExp(`"${k}"`));
      const shownCharts = new Set(c.steps.filter((x) => x.index <= s).flatMap((x) => x.exhibits.filter((e) => e.kind === 'chart').map((e) => e.refId)));
      for (const ch of v.charts ?? []) expect(shownCharts.has(ch.id) || v.claims.some((x) => x.id === ch.entryId)).toBe(true);
      expect(v.assessment === null).toBe(s < lastIndex(c));
      if (s < testStageEnd(c)) for (const h of v.hypotheses) for (const t of h.tests) expect(t.status).toBe('requested');
      if (s < signoffIndex(c) - 1) expect(v.signoff.openEntries).toEqual([]);
      if (v.signoff.signableEntryId) expect(v.hypotheses.find((h) => h.id === v.signoff.signableEntryId)?.versions.at(-1)?.level).toBe(5);
      expect('records' in v).toBe(false);
    });
  }

  it('the last step serves the assessment and the final test results', () => {
    const v = release(c, lastIndex(c));
    expect(v.assessment).toEqual(c.assessment);
    expect(v.hypotheses.map((h) => h.tests)).toEqual(c.hypotheses.map((h) => h.tests));
  });
});

describe('ground truth', () => {
  it('no file in server/api/ or server/engine/ names ground-truth.json', () => {
    for (const dir of ['server/api', 'server/engine']) {
      for (const f of readdirSync(join(process.cwd(), dir))) {
        if (!f.endsWith('.ts')) continue;
        expect(readFileSync(join(process.cwd(), dir, f), 'utf8'), `${dir}/${f}`).not.toMatch(/ground-truth|GroundTruth/);
      }
    }
  });
});

describe.each(CASE_IDS)('sources, glossary and seal, case %s', (id) => {
  const c = cases[id];
  const first = firstStep(c);

  it('releases a source only with the step that first uses it, and a glossary term only when the released text speaks it', () => {
    let seen = new Set<string>();
    for (let s = 0; s < c.steps.length; s++) {
      const v = release(c, s);
      const codes = new Set(v.sources.map((x) => x.code));
      for (const k of seen) expect(codes.has(k as never), `${k} dropped at step ${s}`).toBe(true);
      seen = codes;
      const spoken = JSON.stringify({ title: v.title, lede: v.lede, sources: v.sources, steps: v.steps, claims: v.claims, hypotheses: v.hypotheses, indicators: v.indicators, evidenceItems: v.evidenceItems, expectations: v.expectations }).toLowerCase();
      for (const g of v.glossary ?? []) expect(spoken, `${g.term} at step ${s}`).toContain(g.term.toLowerCase());
      // listed exactly when something released names it, worked out again from the full case file
      const named = new Set<string>(['E1']);
      for (const st of c.steps.filter((x) => x.index <= s)) if (st.trigger && (st.trigger.kind === 'collect' || st.trigger.kind === 'test')) named.add(st.trigger.source);
      for (const x of c.expectations) if (Math.min(...x.timeline.map((t) => t.step)) <= s) named.add(x.fromSource);
      for (const x of c.claims) for (const ver of x.versions) if (ver.step <= s) ver.sources.forEach((k) => named.add(k));
      for (const i of c.indicators) if ((first.get(i.id) ?? 99) <= s) named.add(i.source);
      for (const i of c.evidenceItems) if ((first.get(i.id) ?? 99) <= s) named.add(i.source);
      expect([...codes].sort(), `sources at step ${s}`).toEqual([...named].sort());
    }
    expect([...release(c, 0).sources.map((x) => x.code)]).toEqual(['E1']);
  });

  it('withholds the seal and its announcement until the countersignature', () => {
    const last = lastIndex(c);
    const seals = c.map.shapes.filter((x) => x.kind === 'seal').map((x) => x.id);
    for (let s = 0; s <= last; s++) {
      const bare = release(c, s, { sealed: false });
      expect(bare.map.shapes.some((x) => seals.includes(x.id)), `step ${s}`).toBe(false);
      expect(bare.map.states.every((st) => st.shapes.every((x) => !seals.includes(x.shapeId)))).toBe(true);
    }
    if (seals.length) {
      const sealed = release(c, last, { sealed: true });
      expect(sealed.map.shapes.some((x) => seals.includes(x.id))).toBe(true);
      const at = signoffIndex(c);
      expect(release(c, at, { sealed: false }).steps.at(-1)?.changes.some((ch) => ch.type === 'map')).toBe(false);
      expect(release(c, at, { sealed: true }).steps.at(-1)?.changes.some((ch) => ch.type === 'map')).toBe(true);
    }
  });
});

describe('case a at its first step', () => {
  it('lists no source beyond the call records, and no term for what has not been collected', () => {
    const v = release(cases.a, 0);
    expect(v.sources.map((s) => s.code)).toEqual(['E1']);
    expect((v.glossary ?? []).map((g) => g.term)).not.toContain('timing advance');
    expect((v.glossary ?? []).map((g) => g.term)).not.toContain('IBCF');
    expect(release(cases.a, lastIndex(cases.a)).glossary?.map((g) => g.term)).toContain('timing advance');
  });
});
