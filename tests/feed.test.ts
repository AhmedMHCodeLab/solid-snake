// The synthetic feed the platform ingests: ordinary national traffic plus the four scenario record sets, one stream.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { AnyRecord } from '../shared/types';
import { generate } from '../server/seed/generate';
import { loadGenerated } from '../server/seed/load';
import { DRAIN_DAYS, FEED_DAYS, FEED_END, FEED_START } from '../server/seed/feed';

const { cases, manifest } = loadGenerated();
const path = join(process.cwd(), 'data', 'generated', 'feed.ndjson');
const text = loadGenerated().fromDisk && existsSync(path) ? readFileSync(path, 'utf8') : (generate().find((f) => f.name === 'feed.ndjson') as { text: string }).text;
const lines = text.split('\n').filter(Boolean);
const feed = lines.map((l) => JSON.parse(l) as AnyRecord);
const START = Date.parse(FEED_START);
const DAY = 86400_000;
// The only way to tell a scenario record from ordinary traffic is the case files themselves, which the feed never sees.
const scenarioIds = new Set(['a', 'b', 'c', 'd'].flatMap((id) => [...cases[id as 'a'].records.scscf, ...cases[id as 'a'].records.ibcf].map((r) => r.id)));
const isBackground = (r: AnyRecord): boolean => !scenarioIds.has(r.id);
const dayOf = (r: AnyRecord): number => Math.floor((Date.parse(r.serviceDeliveryStartTimeStamp) - START) / DAY);

describe('feed file', () => {
  it('is one JSON record per line, in the record shapes of an operator export, under 30 MB, with a stated size', () => {
    expect(text.endsWith('}\n')).toBe(true);
    expect(feed.length).toBe(lines.length);
    expect(Buffer.byteLength(text)).toBeLessThan(30 * 1024 * 1024);
    if (process.env.FEED_SAMPLE) console.log(`feed: ${feed.length} records, ${Buffer.byteLength(text)} bytes`);
    for (const r of feed) {
      expect(r.simulated).toBe(true);
      expect(['sCSCFRecord', 'iBCFRecord']).toContain(r.recordType);
      expect(r.serviceDeliveryStartTimeStamp).toMatch(/^2031-03-\d\dT\d\d:\d\d:\d\dZ$/);
    }
  });

  it('is listed in the manifest with its sha256 and record count', () => {
    const m = manifest.files.find((f) => f.name === 'feed.ndjson');
    expect(m).toBeDefined();
    expect(m!.records).toBe(feed.length);
    expect(m!.sha256).toBe(createHash('sha256').update(text).digest('hex'));
  });

  it('is interleaved by start time, and every record falls inside the feed window', () => {
    for (let i = 1; i < feed.length; i++) expect(feed[i - 1]!.serviceDeliveryStartTimeStamp <= feed[i]!.serviceDeliveryStartTimeStamp).toBe(true);
    expect(feed[0]!.serviceDeliveryStartTimeStamp >= FEED_START).toBe(true);
    expect(feed[feed.length - 1]!.serviceDeliveryStartTimeStamp < FEED_END).toBe(true);
  });

  it('has unique ids, and holds every scenario record unchanged under its own id', () => {
    const byId = new Map(feed.map((r) => [r.id, r] as const));
    expect(byId.size).toBe(feed.length);
    let n = 0;
    for (const id of ['a', 'b', 'c', 'd'] as const) {
      for (const r of [...cases[id].records.scscf, ...cases[id].records.ibcf]) {
        expect(JSON.stringify(byId.get(r.id)), r.id).toBe(JSON.stringify(r));
        n++;
      }
    }
    expect(feed.filter((r) => !isBackground(r)).length).toBe(n);
    expect(feed.length - n).toBeGreaterThan(n * 2);
  });

  it('carries no label that tells a scenario from ordinary traffic', () => {
    const keys = new Set<string>();
    for (const r of feed) for (const k of Object.keys(r)) keys.add(k);
    for (const k of keys) expect(k).not.toMatch(/scenario|case|fraud|label|verdict|truth|group/i);
    expect(new Set(feed.filter(isBackground).map((r) => r.recordType))).toEqual(new Set(['sCSCFRecord', 'iBCFRecord']));
  });

  it('gives scenario and ordinary records one id scheme, with nothing in an id or a field that separates them', () => {
    const scen = feed.filter((r) => !isBackground(r));
    const bg = feed.filter(isBackground);
    expect(scen.length).toBeGreaterThan(5000);
    // one scheme: the same pattern for every record, S-CSCF or IBCF, scenario or ordinary, with no letter, case or stream in it
    expect(feed.every((r) => /^CR-[0-9]{8}$/.test(r.id))).toBe(true);
    // the id says nothing about where a record sits in the feed that a neighbour would not: ids rise with time, and every
    // run of scenario records in time order is broken up by ordinary traffic
    const ids = feed.map((r) => Number(r.id.slice(3)));
    expect(ids.every((n, i) => i === 0 || n > ids[i - 1]!)).toBe(true);
    let longest = 0;
    let run = 0;
    for (const r of feed) {
      run = isBackground(r) ? 0 : run + 1;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThan(scen.length / 20);
    // the same field names appear on both sides, and every other identifier has the same shape on both sides
    const fieldsOf = (rs: AnyRecord[]) => new Set(rs.flatMap((r) => Object.keys(r).map((k) => `${r.recordType}.${k}`)));
    const fs = fieldsOf(scen);
    const fb = fieldsOf(bg);
    expect([...fs].filter((k) => !fb.has(k))).toEqual([]);
    expect([...fb].filter((k) => !fs.has(k))).toEqual([]);
    const shape = (v: string) => v.replace(/[0-9a-f]/gi, 'x').replace(/@.*$/, '@d');
    for (const f of ['imsChargingIdentifier', 'sessionId'] as const) {
      const s1 = new Set(scen.filter((r) => r.recordType === 'sCSCFRecord').map((r) => shape(r[f])));
      const s2 = new Set(bg.filter((r) => r.recordType === 'sCSCFRecord').map((r) => shape(r[f])));
      expect([...s1].every((x) => s2.has(x)), f).toBe(true);
    }
  });

  it('keeps ids stable across runs with the same seed', () => {
    const again = (generate().find((f) => f.name === 'feed.ndjson') as { text: string }).text;
    expect(again.split(String.fromCharCode(10)).filter(Boolean).map((l) => (JSON.parse(l) as AnyRecord).id)).toEqual(feed.map((r) => r.id));
  });
});

describe('ordinary traffic in the feed', () => {
  const bg = feed.filter(isBackground);
  const bgS = bg.filter((r) => r.recordType === 'sCSCFRecord' && r.roleOfNode === 'originating');

  it('has a realistic population with ordinary per-SIM volumes', () => {
    const per = new Map<string, number>();
    for (const r of bgS) per.set(r.listOfCallingPartyAddress, (per.get(r.listOfCallingPartyAddress) ?? 0) + 1);
    expect(per.size).toBeGreaterThanOrEqual(120);
    const perDay = [...per.values()].map((n) => n / FEED_DAYS).sort((a, b) => a - b);
    const median = perDay[Math.floor(perDay.length / 2)]!;
    expect(median).toBeGreaterThan(1.5);
    expect(median).toBeLessThan(4);
    expect(perDay[perDay.length - 1]!).toBeLessThan(8);
  });

  it('follows a diurnal shape: busy daytime, quiet night', () => {
    const hours = new Array<number>(24).fill(0);
    for (const r of bg) hours[new Date(r.serviceDeliveryStartTimeStamp).getUTCHours()]!++;
    const day = hours.slice(8, 20).reduce((a, b) => a + b, 0) / 12;
    const night = hours.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
    expect(day / night).toBeGreaterThan(3);
  });

  it('keeps the three international routes at their usual mix and level', () => {
    const per = new Map<string, number>();
    // the planned-maintenance days drain one route on purpose (rule DR-2 flags it); the usual mix is read on the other days
    for (const r of bg) if (r.recordType === 'iBCFRecord' && !DRAIN_DAYS.includes(dayOf(r))) per.set(r.routeRef, (per.get(r.routeRef) ?? 0) + 1);
    expect([...per.keys()].sort()).toEqual(['TG-IPX3-IN-01', 'TG-IPX4-IN-02', 'TG-IPX5-IN-03']);
    const [a, b, c] = ['TG-IPX3-IN-01', 'TG-IPX4-IN-02', 'TG-IPX5-IN-03'].map((k) => per.get(k) as number);
    expect(a! / c!).toBeGreaterThan(0.9);
    expect(a! / c!).toBeLessThan(1.3);
    expect(b! / c!).toBeGreaterThan(0.7);
    expect(b! / c!).toBeLessThan(1.1);
  });

  it('does not show the scenario windows as a bump in daily volume', () => {
    const perDay = new Array<number>(FEED_DAYS).fill(0);
    for (const r of feed) if (r.recordType === 'sCSCFRecord') perDay[dayOf(r)]!++;
    const mean = perDay.reduce((a, b) => a + b, 0) / FEED_DAYS;
    for (const [d, n] of perDay.entries()) {
      expect(n / mean, `day ${d}`).toBeGreaterThan(0.75);
      expect(n / mean, `day ${d}`).toBeLessThan(1.25);
    }
  });

  it('makes the scenario groups stand out from ordinary traffic on a generic per-SIM count, with no scenario logic', () => {
    // Calls per SIM over the 72 hours of case A, counted over the whole feed: the eight SIMs of the group against everyone else.
    const t0 = Date.parse(cases.a.window.start);
    const t1 = Date.parse(cases.a.window.end);
    const per = new Map<string, number>();
    for (const r of feed) {
      if (r.recordType !== 'sCSCFRecord' || r.roleOfNode !== 'originating') continue;
      const t = Date.parse(r.serviceDeliveryStartTimeStamp);
      if (t >= t0 && t < t1) per.set(r.listOfCallingPartyAddress, (per.get(r.listOfCallingPartyAddress) ?? 0) + 1);
    }
    const counts = [...per.values()].sort((x, y) => x - y);
    const p90 = counts[Math.floor(counts.length * 0.9)]!;
    const heavy = counts.filter((n) => n > 3 * p90);
    expect(heavy.length).toBe(8);
  });
});

describe('identifier safety in the feed', () => {
  it('every address, number, subscription and device sits on a code space that belongs to nobody', () => {
    for (const r of feed.filter((x) => x.recordType === 'sCSCFRecord').slice(0, 20000)) {
      expect(r.listOfCallingPartyAddress).toMatch(/^sip:\+999\d{8,12}@ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org;user=phone$/);
      expect(r.calledPartyAddress).toMatch(/^sip:\+999\d{8,12}@ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org;user=phone$/);
      expect(r.listOfSubscriptionId).toMatch(/^999\d{12}$|^trunk\d\d\.ec\d{4}@ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org$/);
      if (r.subscriberEquipmentNumber) expect(r.subscriberEquipmentNumber).toMatch(/^0099\d{11}$/);
    }
    for (const m of text.matchAll(/@([A-Za-z0-9.-]+)/g)) expect(m[1] as string).toMatch(/\.mcc999\.3gppnetwork\.org$/);
    for (const m of text.matchAll(/\+(\d+)/g)) expect((m[1] as string).startsWith('999')).toBe(true);
  });
});
