// Detection over the full feed: deterministic, generic, reproducible, and bound to scenarios only by record membership.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bindScenario, scenarioEvidence } from '../../server/engine/bind';
import { DETECTION_RULES, PARAMS, baselineRecords, detect, detectionValue, digestOf, numberBlock } from '../../server/engine/detect';
import { CASE_IDS, loadCases, loadFeed } from '../../server/engine/feed';
import { RANGE_TOKEN, RULE_FN } from '../../server/seed/rules';
import type { AnyRecord } from '../../shared/types';

const DATA = join(process.cwd(), 'data', 'generated');
const cases = loadCases(DATA);
const feed = loadFeed(DATA, cases);
const detections = detect(feed);
const byId = new Map(feed.records.map((x) => [x.id, x]));
const evidence = scenarioEvidence(cases);
const bound = detections.map((d) => ({ d, scenario: bindScenario(d, evidence) }));

describe('detection over the full feed', () => {
  it('reads the generated feed when it exists, in answer-time order', () => {
    const lines = readFileSync(join(DATA, 'feed.ndjson'), 'utf8').split('\n').filter(Boolean).length;
    expect(feed.records.length).toBe(lines);
    for (let i = 1; i < feed.times.length; i++) expect(feed.times[i]).toBeGreaterThanOrEqual(feed.times[i - 1] as number);
  });

  it('is deterministic', () => {
    expect(detect(loadFeed(DATA, cases))).toEqual(detections);
  });

  it('raises at least one alert for each of the four scenarios, and reports background detections', () => {
    for (const id of CASE_IDS) expect(bound.some((b) => b.scenario === id), `scenario ${id}`).toBe(true);
    const background = bound.filter((b) => b.scenario === null);
    console.log(`detections: ${detections.length}; per scenario ${CASE_IDS.map((id) => `${id}=${bound.filter((b) => b.scenario === id).length}`).join(' ')}; background ${background.length}`);
    for (const b of bound) console.log(`  ${b.d.id} ${b.d.ruleId} ${b.d.at} ${b.d.subject.plainName} value ${b.d.value} baseline ${b.d.baseline.value} records ${b.d.recordIds.length} -> ${b.scenario ?? 'background'}`);
  });

  it('every value reproduces from the records named by recordIds', () => {
    for (const d of detections) {
      const recs = d.recordIds.map((id) => byId.get(id) as AnyRecord);
      expect(recs.every(Boolean)).toBe(true);
      expect(detectionValue(d, recs), d.id).toBe(d.value);
      expect(d.position === 'below' ? d.value < 1 : d.value > d.baseline.value).toBe(true);
      expect(d.at >= d.window.start && d.at <= d.window.end).toBe(true);
      for (const r of recs) expect(r.serviceDeliveryStartTimeStamp < d.at).toBe(true);
    }
  });

  it('the generic block count equals rule R-6 on the premium block', () => {
    for (const d of detections.filter((x) => x.ruleId === 'DR-3' && x.subject.ref.endsWith(`|${RANGE_TOKEN}`))) {
      const recs = d.recordIds.map((id) => byId.get(id) as AnyRecord);
      expect((RULE_FN['R-6'] as (r: AnyRecord[], c: { baseline: number }) => number)(recs, { baseline: 0 })).toBe(d.value);
    }
    expect(numberBlock(`sip:${RANGE_TOKEN}1234567@x.invalid`)).toBe(RANGE_TOKEN);
  });

  it('every rule is defined and the engine holds no scenario knowledge', () => {
    for (const d of detections) expect(DETECTION_RULES.map((r) => r.id)).toContain(d.ruleId);
    const src = readFileSync(join(process.cwd(), 'server', 'engine', 'detect.ts'), 'utf8');
    expect(src).not.toMatch(/ground-truth|CaseId|CaseFile|bind|case-[a-d]|PREMIUM_BLOCK|RANGE_TOKEN|3D1A7|TG-IPX/);
  });

  it('binding is the only place scenario membership enters, and it needs half the records', () => {
    for (const { d, scenario } of bound) {
      if (scenario === null) continue;
      const set = evidence.get(scenario) as Set<string>;
      expect(d.recordIds.filter((r) => set.has(r)).length * 2).toBeGreaterThanOrEqual(d.recordIds.length);
    }
    expect(bindScenario({ recordIds: ['CR-00000001', 'CR-00000002'] }, evidence)).toBeNull();
  });
});

describe('what an alert says about its group and its baseline', () => {
  it('a bound alert counts the same SIMs as the case it opens, and clears its factor with room to spare', () => {
    for (const id of ['a', 'b', 'c'] as const) {
      const d = bound.find((b) => b.scenario === id && b.d.ruleId === 'DR-1')!.d;
      const callers = new Set(cases[id].claims[0]!.versions[0]!.evidenceIds.map((r) => (cases[id].records.scscf.find((x) => x.id === r) as { listOfCallingPartyAddress: string } | undefined)?.listOfCallingPartyAddress).filter(Boolean));
      expect(Number(d.subject.plainName.split(' ')[0]), `case ${id}`).toBe(callers.size);
      expect(d.value / d.baseline.value, `case ${id} margin`).toBeGreaterThanOrEqual(2.3);
    }
  });

  it('exactly three ordinary groups fire the generic rules, one per rule, and are bound to nothing', () => {
    const ordinary = bound.filter((b) => b.scenario === null);
    expect(ordinary.map((b) => b.d.ruleId).sort()).toEqual(['DR-1', 'DR-2', 'DR-3']);
  });

  it('the baseline of every detection is recomputed from the population records it names', () => {
    const times = feed.times;
    const inboundHours = (from: number, to: number, outside: boolean) => {
      const hrs = new Set<number>();
      feed.records.forEach((x, i) => {
        if (x.recordType !== 'iBCFRecord' || x.nniInformation.sessionDirection !== 'inbound') return;
        const t = times[i] as number;
        if ((t >= from && t < to) !== outside) hrs.add(Math.floor((t - Date.parse(feed.window.start)) / 3_600_000));
      });
      return hrs.size;
    };
    for (const d of detections) {
      const pop = baselineRecords(d, feed);
      expect(pop.length, d.id).toBe(d.baselinePopulation.count);
      expect(digestOf(pop), d.id).toBe(d.baselinePopulation.sha256);
      const t0 = Date.parse(d.window.start);
      const t1 = Date.parse(d.window.end);
      if (d.ruleId === 'DR-1') expect((RULE_FN['R-1'] as (r: AnyRecord[], c: { baseline: number }) => number)(pop, { baseline: 0 }), d.id).toBe(d.baseline.value);
      if (d.ruleId === 'DR-3') expect(Math.max(1, pop.length), d.id).toBe(d.baseline.value);
      if (d.ruleId === 'DR-2') {
        const winActive = inboundHours(t0, t1, false);
        const outActive = inboundHours(t0, t1, true);
        const inWindow = d.recordIds.length;
        expect(Math.round(((pop.length) / outActive) * winActive * 10) / 10, d.id).toBe(d.baseline.value);
        expect(inWindow).toBeGreaterThan(0);
      }
    }
  });

  it('an alert is raised only after its rule has held for six hourly checks in a row', () => {
    expect(PARAMS.sustainHours).toBe(6);
    // the first hour a DR-1 group could be read is when five SIMs have appeared; the alert comes at least five hours later
    for (const d of detections.filter((x) => x.ruleId === 'DR-1')) {
      const first = feed.times.findIndex((_, i) => d.recordIds.includes(feed.records[i]!.id));
      expect(Date.parse(d.at) - (feed.times[first] as number)).toBeGreaterThanOrEqual(5 * 3_600_000);
    }
  });
});
