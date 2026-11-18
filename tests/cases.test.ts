// V3, V4, V5 and the data rules of the four cases.
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { AREA_POINTS, finalLevel, levelAt } from '../shared/types';
import type { CaseFile, CaseId, Entry, MapShape, Point } from '../shared/types';
import { geoAreaKm2, polyArea, signedArea } from '../server/seed/geometry';
import { CASE_IDS, loadGenerated } from '../server/seed/load';
import { RECIPIENTS } from '../server/seed/sources';
import { PREMIUM_BLOCK } from '../server/seed/ident';

const { cases, truth } = loadGenerated();
const MIN_AREA_KM2 = 0.05;
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const entries = (c: CaseFile): Entry[] => [...c.claims, ...c.hypotheses];
const entry = (c: CaseFile, id: string): Entry => entries(c).find((e) => e.id === id) as Entry;
const areaOf = (s: MapShape): number => (s.plate === 'national' ? geoAreaKm2(s.points) : polyArea(s.points));
const firstStepWhere = (c: CaseFile, pred: (e: Entry, step: number) => boolean): number => {
  for (const s of c.steps) if (entries(c).some((e) => pred(e, s.index))) return s.index;
  return -1;
};
const haversineKm = (a: Point, b: Point): number => {
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};

describe.each(CASE_IDS)('case %s structure', (id) => {
  const c = cases[id];

  it('covers all seven stages in order, numbered from 0, with unique ids', () => {
    expect(c.steps.map((s) => s.index)).toEqual(c.steps.map((_, i) => i));
    const stages = c.steps.map((s) => s.stage);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
    expect([...new Set(stages)]).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(c.steps.map((s) => s.id)).size).toBe(c.steps.length);
    for (const s of c.steps) {
      expect(s.narrative.length).toBeGreaterThan(1);
      expect(s.changes.length).toBeGreaterThan(0);
    }
    for (const stage of [1, 2, 3, 4, 5, 6, 7]) expect(c.steps.filter((s) => s.stage === stage && s.changes.some((x) => x.type === 'stage')).length).toBe(1);
  });

  it('every step has a trigger and a plain action label, and the triggers form a valid order', () => {
    const last = c.steps.length - 1;
    const sources = new Set(c.sources.map((x) => x.code));
    c.steps.forEach((s, i) => {
      expect(s.trigger, `${s.id} trigger`).toBeDefined();
      expect(s.actionLabel && s.actionLabel.length > 5, `${s.id} actionLabel`).toBe(true);
      expect(s.actionLabel).not.toMatch(DASHES);
      const k = s.trigger!.kind;
      expect(k === 'open', `${s.id} open only at step 0`).toBe(i === 0);
      expect(k === 'close', `${s.id} close only at the last step`).toBe(i === last);
      if (k === 'collect' || k === 'test') expect(sources.has((s.trigger as { source: string }).source as never), `${s.id} source`).toBe(true);
      if (k === 'test') expect((s.trigger as { source: string }).source).toBe('E6');
      if (k === 'collect') expect([2, 4]).toContain(s.stage);
      if (k === 'hypotheses') expect(s.stage).toBe(3);
      if (k === 'signoff') expect(s.stage).toBe(5);
      if (k === 'refer') expect(s.stage).toBe(6);
      if (k === 'close') expect(s.stage).toBe(7);
    });
    const count = (kind: string) => c.steps.filter((s) => s.trigger!.kind === kind).length;
    expect([count('open'), count('hypotheses'), count('signoff'), count('close')]).toEqual([1, 1, 1, 1]);
    expect(count('refer')).toBe(id === 'a' ? 1 : 0);
    // evidence from E2 to E7 is shown only at or after the step whose action requests it
    c.steps.forEach((s, i) => {
      for (const e of s.exhibits) {
        const src = e.kind === 'evidence' ? c.evidenceItems.find((x) => x.id === e.refId)?.source : e.kind === 'indicator' ? c.indicators.find((x) => x.id === e.refId)?.source : e.kind === 'chart' ? c.charts?.find((x) => x.id === e.refId)?.source : undefined;
        if (!src || src === 'E1') continue;
        const asked = c.steps.slice(0, i + 1).some((t) => (t.trigger!.kind === 'collect' || t.trigger!.kind === 'test') && (t.trigger as { source: string }).source === src);
        expect(asked, `${s.id} shows ${e.refId} from ${src} before it is requested`).toBe(true);
      }
    });
  });

  it('stage 1 says detection from records happens after the calls were made', () => {
    const text = c.steps.filter((s) => s.stage === 1).flatMap((s) => s.narrative.map((b) => b.text)).join(' ');
    expect(text).toMatch(/after the calls were made/);
  });

  it('has between 500 and 2000 S-CSCF records, answered sessions only, with optional fields sometimes absent', () => {
    expect(c.records.scscf.length).toBeGreaterThanOrEqual(500);
    expect(c.records.scscf.length).toBeLessThanOrEqual(2000);
    expect(c.recordCounts).toEqual({ scscf: c.records.scscf.length, ibcf: c.records.ibcf.length });
    for (const r of c.records.scscf) {
      expect(r.serviceDeliveryStartTimeStamp).toBeTruthy();
      expect(r.causeForRecordClosing).toBe('serviceDeliveryEndSuccessfully');
      expect(r.recordType).toBe('sCSCFRecord');
      expect(r.serviceRequestTimeStamp.startsWith('2031-03-')).toBe(true);
    }
    expect(c.records.scscf.some((r) => r.serviceDeliveryEndTimeStamp === undefined)).toBe(true);
    expect(c.records.scscf.some((r) => r.requestedPartyAddress === undefined)).toBe(true);
    expect(c.window.start.startsWith('2031-03-')).toBe(true);
  });

  it('uses real-shaped identifiers on code spaces that belong to nobody', () => {
    for (const r of c.records.scscf) {
      for (const u of [r.listOfCallingPartyAddress, r.calledPartyAddress]) expect(u).toMatch(/^sip:\+999\d{8,12}@ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org;user=phone$/);
      expect(r.listOfSubscriptionId).toMatch(id === 'd' || r.listOfSubscriptionId.includes('@') ? /^trunk\d\d\.ec\d{4}@ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org$|^999\d{12}$/ : /^999\d{12}$/);
      expect(r.nodeAddress).toMatch(/^scscf0[1-3]\.ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org$/);
      expect(r.sessionId).toMatch(/^scscf0[1-3]\.ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org;\d{10};\d+$/);
      expect(r.imsChargingIdentifier).toMatch(/^[a-f][0-9a-f]{15}@ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org$/);
      if (r.userLocationInfo) {
        expect(r.userLocationInfo.tai).toMatch(/^999-\d\d-[0-9A-F]{4}$/);
        expect(r.userLocationInfo.ecgi).toMatch(/^999-\d\d-[0-9A-F]{7}$/);
      }
      if (r.accessNetworkInformation) expect(r.accessNetworkInformation.value).toMatch(/^3GPP-E-UTRAN-FDD; utran-cell-id-3gpp=999\d\d[0-9A-F]{11}$/);
      if (r.subscriberEquipmentNumber) expect(r.subscriberEquipmentNumber).toMatch(/^0099\d{11}$/);
      if (r.instanceId) expect(r.instanceId).toMatch(/^urn:gsma:imei:0099\d{4}-\d{6}-0$/);
    }
    for (const r of c.records.ibcf) {
      expect(r.routeRef).toMatch(/^TG-IPX[345]-(IN|OUT)-\d\d$/);
      expect(r.nniInformation.neighbourNodeAddress).toMatch(/^sbc01\.ims\.mnc08\d\.mcc999\.3gppnetwork\.org$/);
    }
  });

  it('record keys are all listed in fieldSpecs with their specification table', () => {
    const keys = (rs: object[], spec: string) => {
      const used = new Set<string>();
      for (const r of rs) for (const k of Object.keys(r)) if (k !== 'id' && k !== 'simulated') used.add(k);
      for (const k of used) expect(c.fieldSpecs.some((f) => f.key === k && f.spec === spec), `${spec} ${k}`).toBe(true);
    };
    keys(c.records.scscf, 'TS 32.260 Table 6.1.3.3.1');
    keys(c.records.ibcf, 'TS 32.260 Table 6.1.3.10.1');
    for (const f of c.fieldSpecs) expect(['M', 'OM', 'OC']).toContain(f.category);
  });

  it('strip lanes and ticks refer to records of the case', () => {
    const ids = new Map(c.records.scscf.map((r) => [r.id, r]));
    expect(c.strip.ticks.length).toBeGreaterThan(0);
    for (const [min, lane, , rid] of c.strip.ticks) {
      expect(ids.has(rid)).toBe(true);
      expect(lane).toBeGreaterThanOrEqual(0);
      expect(lane).toBeLessThan(c.strip.lanes.length);
      expect(min).toBeGreaterThanOrEqual(0);
    }
    expect(c.strip.lanes.length).toBe({ a: 8, b: 50, c: 24, d: 1 }[id]);
  });

  it('recipients are always the same four simulated roles in order', () => {
    expect(c.recipients).toEqual(RECIPIENTS);
    expect(c.recipients.map((r) => r.title)).toEqual(['Unit lead', 'Agency head', 'Regulator desk', 'Law-enforcement desk']);
    for (const r of c.recipients) {
      expect(r.basis).toBe('FICTION');
      expect(r.label).toBe('(simulated role)');
    }
  });

  it('sign-off: a signable entry is at level 5, open entries are listed, reason codes are prepared', () => {
    const { signableEntryId, openEntries, reasonCodes, supervisorChecks } = c.signoff;
    if (signableEntryId) expect(finalLevel(entry(c, signableEntryId))).toBe(5);
    else expect(entries(c).every((e) => finalLevel(e) !== 5)).toBe(true);
    const open = entries(c).filter((e) => finalLevel(e) !== null && finalLevel(e) !== 5);
    expect(openEntries.map((o) => o.entryId).sort()).toEqual(open.map((e) => e.id).sort());
    for (const o of openEntries) {
      expect(o.level).toBe(finalLevel(entry(c, o.entryId)));
      expect(o.lacks.length).toBeGreaterThan(15);
    }
    for (const rc of reasonCodes) {
      if (rc.actions.includes('promote')) expect(rc.entryIds).toEqual([signableEntryId]);
      for (const e of rc.entryIds) expect(entry(c, e)).toBeDefined();
    }
    const fallen = entries(c).filter((e) => finalLevel(e) === null);
    for (const e of [...open, ...fallen]) {
      expect(reasonCodes.some((rc) => rc.actions.includes('hold') && rc.entryIds.includes(e.id))).toBe(true);
      expect(reasonCodes.some((rc) => rc.actions.includes('reject') && rc.entryIds.includes(e.id))).toBe(true);
    }
    expect(supervisorChecks.length).toBe(3);
    expect(c.assessment.captions.length).toBeGreaterThan(0);
    for (const cap of c.assessment.captions) for (const e of cap.entryIds) expect(entry(c, e)).toBeDefined();
    expect(c.assessment.notEstablished.length).toBeGreaterThan(0);
  });

  it('each CaseSummary (the case without records) is at most 40 KB gzipped', () => {
    const { records: _r, ...summary } = c;
    const gz = gzipSync(Buffer.from(JSON.stringify(summary, null, 2) + '\n')).length;
    expect(gz, `case ${id} summary is ${gz} bytes gzipped`).toBeLessThanOrEqual(40 * 1024);
  });
});

describe.each(CASE_IDS)('platform data of case %s', (id) => {
  const c = cases[id];
  it('has case metadata with the exact handling line, entities with plain names and a complete glossary', () => {
    expect(c.meta?.handling).toBe('SIMULATED // EXERCISE DATA');
    expect(c.meta?.reference).toMatch(/^TFIU\/2031\/\d{4}$/);
    expect(c.meta?.opened.startsWith('2031-03-')).toBe(true);
    for (const f of ['originator', 'tasking', 'desk'] as const) expect((c.meta as unknown as Record<string, string>)[f]!.length).toBeGreaterThan(5);
    expect(['Routine', 'Priority', 'Immediate']).toContain(c.meta?.priority);
    expect(c.entities!.length).toBeGreaterThan(2);
    for (const e of c.entities!) {
      expect(e.plainName.length).toBeGreaterThan(3);
      expect(e.basis).toBe('FICTION');
      expect(e.id).toMatch(/^(MNO-\d|IPX-\d|EC-\d{4}|TFIU)$/);
    }
    expect(c.meta!.originator).toContain(c.entities!.find((e) => e.kind === 'Mobile network operator')!.plainName);
    for (const g of c.glossary!) for (const k of ['term', 'plain', 'explain'] as const) expect(g[k].length, `${g.term} ${k}`).toBeGreaterThanOrEqual(2);
  });
  it('every source, field and entity has a plain name, and every source an explanation and a connector', () => {
    for (const s of c.sources) {
      expect(s.plainName!.length, s.code).toBeGreaterThan(3);
      expect(s.explain!.length, s.code).toBeGreaterThan(30);
    }
    for (const f of c.fieldSpecs) {
      expect(f.plainName!.length, f.key).toBeGreaterThan(3);
      expect(f.explain!.length, f.key).toBeGreaterThan(20);
    }
  });
});

describe('connectors', () => {
  it('has one demo connector per source with a plain name and a turnaround', () => {
    const list = JSON.parse(loadGenerated().texts['connectors.json'] as string) as { source: string; plainName: string; mode: string; turnaroundMinutes: number }[];
    expect(list.map((x) => x.source)).toEqual(['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']);
    for (const x of list) {
      expect(x.mode).toBe('demo-synthetic');
      expect(x.plainName.length).toBeGreaterThan(3);
      expect(x.turnaroundMinutes).toBeGreaterThanOrEqual(0);
    }
    for (const id of CASE_IDS) for (const s of cases[id].sources) expect(list.find((x) => x.source === s.code)!.plainName).toBe(s.plainName);
  });
});

describe.each(CASE_IDS)('V3 hard negatives, case %s', (id) => {
  const c = cases[id];
  it('at the first step where any hypothesis is level 4, an innocent hypothesis is open at that step', () => {
    const step = firstStepWhere(c, (e, s) => e.kind === 'hypothesis' && levelAt(e, s) === 4);
    expect(step).toBeGreaterThanOrEqual(0);
    const innocentOpen = c.hypotheses.filter((h) => h.innocent && levelAt(h, step) === 4);
    expect(innocentOpen.length).toBeGreaterThan(0);
    for (const h of c.hypotheses.filter((x) => levelAt(x, step) === 4)) {
      expect(h.rivals.length).toBeGreaterThan(0);
      for (const rv of h.rivals) expect(levelAt(entry(c, rv), step)).toBe(4);
    }
  });
});

describe('outcomes', () => {
  it('V4: case B never reaches level 5 and leaves both hypotheses open', () => {
    const c = cases.b;
    for (const s of c.steps) for (const e of entries(c)) expect(levelAt(e, s.index)).not.toBe(5);
    expect(finalLevel(entry(c, 'H-B1'))).toBe(4);
    expect(finalLevel(entry(c, 'H-B2'))).toBe(4);
    expect(c.hypotheses.every((h) => h.versions.every((v) => v.state === 'open'))).toBe(true);
    expect(c.signoff.signableEntryId).toBeNull();
    expect(c.assessment.outcome).toBe('assessment-record');
    const last = c.steps[c.steps.length - 1]!;
    expect(last.narrative.filter((b) => b.kind === 'claim' && (b.entryId === 'H-B1' || b.entryId === 'H-B2')).length).toBe(2);
  });

  it('case A reaches level 5 by E6 in stage 4, rivals fall, and it is the only signable case', () => {
    const c = cases.a;
    const h1 = entry(c, 'H-A1') as CaseFile['hypotheses'][number];
    const v5 = h1.versions.find((v) => v.level === 5)!;
    expect(c.steps[v5.step]!.stage).toBe(4);
    expect(v5.evidenceIds).toEqual(['EVI-A-E6']);
    expect(finalLevel(h1)).toBe(5);
    expect(finalLevel(entry(c, 'H-A2'))).toBeNull();
    expect(finalLevel(entry(c, 'H-A3'))).toBeNull();
    expect(c.signoff.signableEntryId).toBe('H-A1');
    expect(c.assessment.outcome).toBe('signed-and-referred');
    for (const id of ['EXP-A-1', 'EXP-A-2', 'EXP-A-3']) expect(c.expectations.find((e) => e.id === id)).toBeDefined();
    expect(c.records.ibcf.length).toBeGreaterThan(0);
    expect(new Set(c.records.ibcf.map((r) => r.routeRef)).size).toBe(3);
    const ind = (i: string) => c.indicators.find((x) => x.id === i)!;
    expect(ind('I-2').position).toBe('below');
    expect(ind('I-5').position).toBe('within');
    expect(ind('I-6').position).toBe('within');
    expect(c.records.scscf.filter((r) => r.roleOfNode === 'terminating' && c.strip.lanes.length === 8).length).toBeGreaterThan(0);
  });

  it('case C: H-C1 falls and is struck, H-C2 stands at level 4, nothing is signable', () => {
    const c = cases.c;
    expect(finalLevel(entry(c, 'H-C1'))).toBeNull();
    expect(finalLevel(entry(c, 'H-C2'))).toBe(4);
    expect(finalLevel(entry(c, 'C-1'))).toBe(3);
    const fall = (entry(c, 'H-C1') as CaseFile['hypotheses'][number]).versions.find((v) => v.state === 'fallen')!;
    expect(c.steps[fall.step]!.stage).toBe(4);
    expect(fall.evidenceIds).toContain('EVI-C-E4');
    expect(c.signoff.signableEntryId).toBeNull();
    expect(c.assessment.captions.some((x) => /not fraud on this evidence/i.test(x.text))).toBe(true);
    expect(c.assessment.outcome).toBe('assessment-record');
  });

  it('case D: location fields are absent everywhere, H-D1 stays at level 4 with rivals', () => {
    const c = cases.d;
    for (const r of c.records.scscf) {
      expect(r.userLocationInfo).toBeUndefined();
      expect(r.accessNetworkInformation).toBeUndefined();
    }
    expect(c.records.scscf.some((r) => r.calledPartyAddress.includes(PREMIUM_BLOCK))).toBe(true);
    expect(finalLevel(entry(c, 'H-D1'))).toBe(4);
    expect(c.hypotheses.filter((h) => h.innocent).length).toBe(2);
    expect(c.signoff.signableEntryId).toBeNull();
    expect(c.assessment.outcome).toBe('assessment-record');
    for (const id of ['EXP-D-1', 'EXP-D-2', 'EXP-D-3']) expect(c.expectations.find((e) => e.id === id)).toBeDefined();
  });

  it('only case A signs; no other case reaches level 5 or a referral outcome', () => {
    for (const id of CASE_IDS) {
      const c = cases[id];
      expect(c.signoff.signableEntryId !== null).toBe(id === 'a');
      expect(c.assessment.outcome === 'signed-and-referred').toBe(id === 'a');
    }
  });
});

describe.each(CASE_IDS)('V5 geospatial honesty, case %s', (id) => {
  const c = cases[id];
  const byId = new Map(c.map.shapes.map((s) => [s.id, s]));

  it('the national plate carries only region shapes; every area has AREA_POINTS points, is clockwise from north and is above the minimum', () => {
    for (const s of c.map.shapes) {
      if (s.plate === 'national') expect(s.kind).toBe('region');
      expect(s.kind).not.toBe('route');
      if (s.kind === 'verified-site') {
        expect(s.points.length).toBe(1);
        continue;
      }
      expect(s.points.length, s.id).toBe(AREA_POINTS);
      expect(areaOf(s), s.id).toBeGreaterThanOrEqual(MIN_AREA_KM2);
      expect(signedArea(s.points), `${s.id} winding`).toBeLessThan(0);
      const top = Math.max(...s.points.map((p) => p[1]));
      expect(s.points[0]![1], `${s.id} starts at the north-most point`).toBe(top);
    }
  });

  it('map states resolve, have a size that matches their shape, and carry the simulated mark', () => {
    expect(c.map.states.length).toBe(c.steps.length);
    c.map.states.forEach((m, i) => {
      expect(m.step).toBe(i);
      expect(m.note).toMatch(/SIMULATED|simulated/);
      if (m.area) {
        const s = byId.get(m.area.shapeId)!;
        expect(s, m.area.shapeId).toBeDefined();
        expect(s.points.length).toBe(AREA_POINTS);
        expect(s.plate).toBe(m.plate);
        expect(Math.abs(m.area.areaKm2 - areaOf(s))).toBeLessThan(0.01);
        expect(m.area.areaKm2).toBeGreaterThanOrEqual(MIN_AREA_KM2);
      }
      for (const sh of m.shapes) {
        const s = byId.get(sh.shapeId)!;
        expect(s, sh.shapeId).toBeDefined();
        expect(s.plate).toBe(m.plate);
      }
      if (m.spotlightShapeId) expect(byId.has(m.spotlightShapeId)).toBe(true);
    });
  });

  it('the verified site exists only in case A, on the case plate, from the step where a hypothesis is level 5', () => {
    const sites = c.map.shapes.filter((s) => s.kind === 'verified-site');
    expect(sites.length).toBe(id === 'a' ? 1 : 0);
    const l5 = firstStepWhere(c, (e, s) => e.kind === 'hypothesis' && levelAt(e, s) === 5);
    for (const s of sites) {
      expect(s.plate).toBe('case');
      expect(l5).toBeGreaterThanOrEqual(0);
      c.map.states.forEach((m, i) => {
        const shown = m.shapes.some((x) => x.shapeId === s.id) || m.spotlightShapeId === s.id;
        if (i < l5) expect(shown, `step ${i}`).toBe(false);
      });
      expect(c.map.states[l5]!.shapes.some((x) => x.shapeId === s.id)).toBe(true);
    }
    for (const seal of c.map.shapes.filter((s) => s.kind === 'seal')) {
      expect(seal.boundTo).toBe('H-A1');
      const band = c.map.shapes.find((s) => s.kind === 'band')!;
      expect(seal.points).toEqual(band.points);
    }
  });

  it('after the test, the surviving footprint is solid in case A and the fallen ones dissolve', () => {
    const last = c.map.states[c.map.states.length - 1]!;
    const style = (hid: string) => last.shapes.find((x) => x.shapeId === c.hypotheses.find((h) => h.id === hid)?.footprintShapeId)?.style;
    if (id === 'a') {
      expect(style('H-A1')).toBe('solid');
      expect(style('H-A2')).toBe('dissolved');
      expect(style('H-A3')).toBe('dissolved');
    }
    if (id === 'c') {
      expect(style('H-C1')).toBe('dissolved');
      expect(style('H-C2')).toBe('dashed');
    }
    if (id === 'b') {
      expect(style('H-B1')).toBe('dashed');
      expect(style('H-B2')).toBe('dashed');
    }
    const before = c.map.states.find((m) => m.shapes.some((x) => x.style === 'dashed'));
    if (id !== 'd') expect(before).toBeDefined();
  });

  it('case plate shapes sit inside the plate; the plate carries the fictional-positions disclaimer', () => {
    if (id === 'd') return;
    expect(c.map.casePlate.disclaimer).toBe('Positions on this plate are simulated and do not correspond to real places.');
    for (const s of c.map.shapes.filter((x) => x.plate === 'case')) {
      for (const p of s.points) {
        expect(p[0]).toBeGreaterThanOrEqual(0);
        expect(p[0]).toBeLessThanOrEqual(c.map.casePlate.widthKm);
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(p[1]).toBeLessThanOrEqual(c.map.casePlate.heightKm);
      }
    }
    for (const sec of c.map.casePlate.sectors) expect(sec.basis).toBe('ASSUMPTION');
  });
});

describe('regions and case D', () => {
  const DOHA: Point = [51.53, 25.29];
  it('regions are broad, well inside the land, away from the capital, and different for cases A, B and C', () => {
    const centres: Point[] = [];
    for (const id of ['a', 'b', 'c'] as CaseId[]) {
      const c = cases[id];
      const region = c.map.shapes.find((s) => s.kind === 'region')!;
      expect(c.map.region!.shapeId).toBe(region.id);
      const lons = region.points.map((p) => p[0]);
      const lats = region.points.map((p) => p[1]);
      expect(Math.min(...lons)).toBeGreaterThan(50.85);
      expect(Math.max(...lons)).toBeLessThan(51.5);
      expect(Math.min(...lats)).toBeGreaterThan(24.7);
      expect(Math.max(...lats)).toBeLessThan(26.0);
      const widthKm = (Math.max(...lons) - Math.min(...lons)) * 100;
      const heightKm = (Math.max(...lats) - Math.min(...lats)) * 110;
      expect(widthKm).toBeGreaterThan(20);
      expect(widthKm).toBeLessThan(50);
      expect(heightKm).toBeGreaterThan(20);
      expect(heightKm).toBeLessThan(50);
      const centre: Point = [(Math.max(...lons) + Math.min(...lons)) / 2, (Math.max(...lats) + Math.min(...lats)) / 2];
      expect(haversineKm(centre, DOHA)).toBeGreaterThan(30);
      centres.push(centre);
    }
    expect(new Set(centres.map((p) => p.join(','))).size).toBe(3);
  });

  it('case D has no region and no area at any step', () => {
    const c = cases.d;
    expect(c.map.region).toBeNull();
    expect(c.map.shapes).toEqual([]);
    for (const m of c.map.states) {
      expect(m.area).toBeNull();
      expect(m.shapes).toEqual([]);
    }
  });
});

describe('ground truth stays out of the case files', () => {
  const words = (s: string) => s.toLowerCase().match(/[a-z]{5,}/g) ?? [];
  const GENERIC = new Set(['sim-box', 'other']);
  it('no case title, lede, step title or caption carries a word of its catalogue role', () => {
    for (const id of CASE_IDS) {
      const c = cases[id];
      const role = truth.cases[id].role;
      const visible = [c.title, c.lede, ...c.steps.map((s) => s.title), ...c.assessment.captions.map((x) => x.text)].join(' \n ').toLowerCase();
      expect(visible).not.toContain(role.toLowerCase());
      for (const w of words(role)) if (!GENERIC.has(w)) expect(visible, `${id}: "${w}"`).not.toMatch(new RegExp(`\\b${w}\\b`));
    }
  });

  it('no case file contains the text of its ground truth, and no record carries a verdict field', () => {
    for (const id of CASE_IDS) {
      const text = JSON.stringify(cases[id]);
      expect(text).not.toContain(truth.cases[id].truth.slice(0, 40));
      for (const r of [...cases[id].records.scscf, ...cases[id].records.ibcf]) for (const k of Object.keys(r)) expect(k).not.toMatch(/fraud|isFraud|label|verdict|truth/i);
    }
    expect(Object.keys(truth.cases).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
