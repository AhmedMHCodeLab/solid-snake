// V1: every claim and hypothesis version traces to records, indicators or evidence items in the same case.
import { describe, expect, it } from 'vitest';
import { levelAt } from '../shared/types';
import type { AnyRecord, CaseFile, Entry } from '../shared/types';
import { CHART_FN, RULE_FN, subjectCallers } from '../server/seed/rules';
import type { ChartCtx } from '../server/seed/rules';
import { IN_ROUTES } from '../server/seed/ident';
import { CASE_IDS, loadGenerated } from '../server/seed/load';

const { cases } = loadGenerated();

function index(c: CaseFile) {
  const records = new Map<string, AnyRecord>();
  for (const x of [...c.records.scscf, ...c.records.ibcf]) records.set(x.id, x);
  const indicators = new Set(c.indicators.map((i) => i.id));
  const items = new Set(c.evidenceItems.map((i) => i.id));
  const entries = new Map<string, Entry>([...c.claims, ...c.hypotheses].map((e) => [e.id, e]));
  const expectations = new Set(c.expectations.map((e) => e.id));
  const charts = new Set((c.charts ?? []).map((e) => e.id));
  const resolves = (id: string) => records.has(id) || indicators.has(id) || items.has(id);
  return { records, indicators, items, entries, expectations, charts, resolves };
}

describe.each(CASE_IDS)('V1 provenance, case %s', (id) => {
  const c = cases[id];
  const ix = index(c);

  it('every claim version has evidence that resolves', () => {
    for (const cl of c.claims) {
      expect(cl.versions.length).toBeGreaterThan(0);
      for (const v of cl.versions) {
        expect(v.evidenceIds.length, `${cl.id}@${v.step}`).toBeGreaterThan(0);
        for (const e of v.evidenceIds) expect(ix.resolves(e), `${cl.id}@${v.step} ${e}`).toBe(true);
        expect(v.sources.length).toBeGreaterThan(0);
        if (v.ruleId) expect(c.rules.some((r) => r.id === v.ruleId), `${cl.id} rule ${v.ruleId}`).toBe(true);
      }
    }
  });

  it('every hypothesis version has evidence that resolves', () => {
    for (const h of c.hypotheses) {
      expect(h.versions.length).toBeGreaterThan(0);
      for (const v of h.versions) {
        expect(v.evidenceIds.length, `${h.id}@${v.step}`).toBeGreaterThan(0);
        for (const e of v.evidenceIds) expect(ix.resolves(e), `${h.id}@${v.step} ${e}`).toBe(true);
      }
      for (const cited of h.cites) expect(ix.entries.get(cited)?.kind).toBe('evidence');
      for (const rival of h.rivals) expect(ix.entries.get(rival)?.kind).toBe('hypothesis');
      if (h.footprintShapeId) expect(c.map.shapes.some((s) => s.id === h.footprintShapeId)).toBe(true);
    }
  });

  it('every level 3 version names an independence statement that resolves and matches its sources', () => {
    for (const cl of c.claims) {
      for (const v of cl.versions) {
        if (v.level !== 3) {
          expect(v.independenceId).toBeUndefined();
          continue;
        }
        const ind = c.independence.find((i) => i.id === v.independenceId);
        expect(ind, `${cl.id}@${v.step}`).toBeDefined();
        for (const s of ind!.pair) expect(v.sources).toContain(s);
        expect(ind!.statement.length).toBeGreaterThan(40);
      }
    }
  });

  it('versions rise by evidence: steps ascend and each version names a new step', () => {
    for (const e of [...c.claims, ...c.hypotheses]) {
      const steps = e.versions.map((v) => v.step);
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      expect(new Set(steps).size).toBe(steps.length);
    }
  });

  it('every indicator recomputes to its stored value from its records', () => {
    for (const i of c.indicators) {
      const fn = RULE_FN[i.ruleId];
      expect(fn, `rule ${i.ruleId}`).toBeDefined();
      expect(c.rules.some((r) => r.id === i.ruleId)).toBe(true);
      expect(i.recordIds.length).toBeGreaterThan(0);
      const recs = i.recordIds.map((rid) => {
        const rec = ix.records.get(rid);
        expect(rec, `${i.id} ${rid}`).toBeDefined();
        return rec as AnyRecord;
      });
      expect(fn!(recs, { baseline: i.baseline.value }), i.id).toBe(i.value);
      expect(i.baseline.population.length).toBeGreaterThan(10);
    }
  });

  it('every map shape is bound to an entry, with a label and a derivation', () => {
    for (const s of c.map.shapes) {
      expect(ix.entries.has(s.boundTo), `${s.id} -> ${s.boundTo}`).toBe(true);
      expect(s.label.length).toBeGreaterThan(5);
      expect(s.derivation.length).toBeGreaterThan(5);
    }
  });

  it('every expectation resolves its limits, rule and timeline', () => {
    for (const e of c.expectations) {
      expect(e.limits.length).toBeGreaterThan(0);
      for (const l of e.limits) expect(ix.entries.has(l), `${e.id} -> ${l}`).toBe(true);
      expect(c.rules.some((r) => r.id === e.ruleId), `${e.id} rule`).toBe(true);
      expect(c.sources.some((s) => s.code === e.fromSource), `${e.id} source`).toBe(true);
      for (const t of e.timeline) expect(t.step).toBeLessThan(c.steps.length);
    }
    for (const cl of c.claims) for (const x of cl.limitedBy) expect(ix.expectations.has(x)).toBe(true);
  });

  it('every exhibit refId resolves', () => {
    for (const s of c.steps) {
      for (const e of s.exhibits) {
        const ok = ix.resolves(e.refId) || ix.expectations.has(e.refId) || ix.entries.has(e.refId) || ix.charts.has(e.refId);
        expect(ok, `${s.id} ${e.refId}`).toBe(true);
        expect(e.label.accession).toBe(e.refId);
      }
    }
  });

  it('every claim narrative block carries the level its entry holds at that step', () => {
    for (const s of c.steps) {
      for (const b of s.narrative) {
        if (b.kind !== 'claim') continue;
        const e = ix.entries.get(b.entryId);
        expect(e, `${s.id} ${b.entryId}`).toBeDefined();
        expect(b.level, `${s.id} ${b.entryId}`).toBe(levelAt(e!, s.index));
      }
    }
  });

  it('every version that appears is announced by a change at its step, and change evidence resolves', () => {
    for (const e of [...c.claims, ...c.hypotheses]) {
      e.versions.forEach((v, i) => {
        const prev = i === 0 ? null : e.versions[i - 1]!;
        const before = prev === null ? null : prev.level;
        if (before === v.level) return;
        const step = c.steps[v.step]!;
        const ch = step.changes.find((x) => (x.type === 'level-rise' || x.type === 'level-fall') && x.entryId === e.id);
        expect(ch, `${e.id}@${v.step}`).toBeDefined();
        expect(ch!.type === 'level-fall' ? v.level === null : true).toBe(true);
      });
    }
    for (const s of c.steps) {
      for (const ch of s.changes) {
        expect(ch.announce.length).toBeGreaterThan(10);
        if (ch.type === 'level-rise' || ch.type === 'level-fall') {
          expect(ch.evidenceIds.length).toBeGreaterThan(0);
          for (const e of ch.evidenceIds) expect(ix.resolves(e)).toBe(true);
          expect(ch.announce).toContain(ch.entryId);
        }
        if (ch.type === 'spotlight') expect(s.exhibits.some((x) => x.id === ch.exhibitId)).toBe(true);
      }
    }
  });

  it('every chart is bound to an entry, names its rule and source, and recomputes from its records', () => {
    expect((c.charts ?? []).length).toBeGreaterThanOrEqual(id === 'd' ? 3 : id === 'c' ? 3 : 4);
    const buckets = c.window ? Math.round((Date.parse(c.window.end) - Date.parse(c.window.start)) / 3600000) : 72;
    for (const ch of c.charts ?? []) {
      expect(ix.entries.has(ch.entryId), `${ch.id} entry`).toBe(true);
      expect(c.rules.some((r) => r.id === ch.ruleId), `${ch.id} rule`).toBe(true);
      expect(c.sources.some((x) => x.code === ch.source), `${ch.id} source`).toBe(true);
      for (const t of [ch.title, ch.unit, ch.xLabel, ch.yLabel, ch.note]) expect(t.length, ch.id).toBeGreaterThan(3);
      expect(ch.recordIds.length).toBeGreaterThan(0);
      const recs = ch.recordIds.map((rid) => ix.records.get(rid) as AnyRecord);
      for (const [k, x] of recs.entries()) expect(x, `${ch.id} ${ch.recordIds[k]}`).toBeDefined();
      const entry = ix.entries.get(ch.entryId) as Entry;
      const l1 = entry.versions[0]!.evidenceIds;
      const first = ch.series[0];
      const ctx: ChartCtx = {
        startMs: Date.parse(c.window.start),
        bucketMinutes: ch.bucketMinutes ?? 60,
        buckets: ch.kind === 'timeseries' ? buckets : ch.bucketMinutes === 1440 ? 3 : 0,
        subject: subjectCallers(l1, ix.records),
      };
      if (ch.ruleId === 'R-12') {
        ctx.routeRefs = (ch.categories as string[]).map((label) => IN_ROUTES.find((x) => x.short === label)!.ref);
        ctx.baselines = ctx.routeRefs.map((ref) => c.indicators.find((i) => i.ruleId === 'R-2' && (ix.records.get(i.recordIds[0] as string) as { routeRef?: string }).routeRef === ref)!.baseline.value);
      }
      if (ch.ruleId === 'R-14') ctx.baselines = [1, 2, 3].map(() => c.indicators.find((i) => i.id === 'I-1')!.baseline.value / 3);
      const calc = CHART_FN[ch.ruleId]!(recs, ctx);
      expect(ch.series.map((x) => x.id), ch.id).toEqual(ch.series.map((x) => x.id).filter((n) => n in calc.series));
      for (const sr of ch.series) expect(sr.values, `${ch.id} ${sr.id}`).toEqual(calc.series[sr.id]);
      expect(ch.categories, ch.id).toEqual(ch.kind === 'comparison' ? ch.categories : calc.categories);
      if (ch.kind === 'timeseries') {
        expect(ch.band, ch.id).toBeDefined();
        expect(ch.band!.low).toEqual(calc.band!.low);
        expect(ch.band!.high).toEqual(calc.band!.high);
        expect(ch.band!.label.length).toBeGreaterThan(3);
        for (const sr of ch.series) expect(sr.values.length).toBe(buckets);
        expect(ch.band!.low.length).toBe(buckets);
        for (let b = 0; b < buckets; b++) expect(ch.band!.low[b]!).toBeLessThanOrEqual(ch.band!.high[b]!);
      }
      if (ch.kind === 'distribution' || ch.kind === 'comparison') {
        expect(ch.categories!.length).toBeGreaterThan(1);
        for (const sr of ch.series) expect(sr.values.length, `${ch.id} ${sr.id}`).toBe(ch.categories!.length);
      }
      if (ch.kind === 'distribution') expect(ch.marker!.value).toBe(calc.marker);
      if (ch.kind === 'links') {
        expect(ch.graph).toEqual(calc.graph);
        const nodes = new Set(ch.graph!.nodes.map((n) => n.id));
        for (const e of ch.graph!.edges) {
          expect(nodes.has(e.from) && nodes.has(e.to), `${ch.id} edge`).toBe(true);
          expect(e.weight).toBeGreaterThan(0);
        }
        for (const n of ch.graph!.nodes) expect(n.label.length).toBeGreaterThan(3);
      }
      void first;
    }
    for (const ch of c.charts ?? []) expect(c.steps.some((s) => s.exhibits.some((e) => e.kind === 'chart' && e.refId === ch.id)), `${ch.id} is shown`).toBe(true);
    for (const s of c.steps) for (const e of s.exhibits) if (e.kind === 'chart') expect(ix.charts.has(e.refId)).toBe(true);
  });
});
