// Loads the generated scenario files and the feed from data/generated: case files, feed.ndjson and nothing else.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyRecord, CaseFile, CaseId } from '../../shared/types';

export const CASE_IDS: readonly CaseId[] = ['a', 'b', 'c', 'd'];

export interface Feed {
  /** Every record, sorted by answer time then id. */
  records: AnyRecord[];
  /** Whole UTC days covering the records. */
  window: { start: string; end: string };
  /** Answer time in ms, same order as records. */
  times: number[];
}

export const recordTime = (x: AnyRecord): number => Date.parse(x.serviceDeliveryStartTimeStamp);

export function loadCases(dataDir: string): Record<CaseId, CaseFile> {
  const out = {} as Record<CaseId, CaseFile>;
  for (const id of CASE_IDS) out[id] = JSON.parse(readFileSync(join(dataDir, `case-${id}.json`), 'utf8')) as CaseFile;
  return out;
}

const DAY = 86_400_000;

/** The one feed loader. feed.ndjson (background plus scenarios) when the generator has written it, else the case files' records. */
export function loadFeed(dataDir: string, cases: Record<CaseId, CaseFile>): Feed {
  const path = join(dataDir, 'feed.ndjson');
  const raw: AnyRecord[] = existsSync(path)
    ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as AnyRecord)
    : CASE_IDS.flatMap((id) => [...cases[id].records.scscf, ...cases[id].records.ibcf]);
  const records = raw.map((x) => ({ x, t: recordTime(x) })).sort((a, b) => a.t - b.t || (a.x.id < b.x.id ? -1 : a.x.id > b.x.id ? 1 : 0));
  if (records.length === 0) throw new Error('the feed has no records');
  const first = (records[0] as { t: number }).t;
  const last = (records[records.length - 1] as { t: number }).t;
  const start = Math.floor(first / DAY) * DAY;
  const end = Math.floor(last / DAY) * DAY + DAY;
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19) + 'Z';
  return { records: records.map((r) => r.x), times: records.map((r) => r.t), window: { start: iso(start), end: iso(end) } };
}

/** Network inventory: which broad region each fictional cell sits in. Built from the cell plan in the case files, not from any scenario role. */
export function cellRegions(cases: Record<CaseId, CaseFile>): Map<string, string> {
  const out = new Map<string, string>();
  for (const id of CASE_IDS) {
    const m = cases[id].map;
    if (!m.region) continue;
    for (const s of m.casePlate.sectors) out.set(s.cellRef, m.region.shapeId);
  }
  return out;
}
