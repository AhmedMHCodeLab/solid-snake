// Builds every generated file in memory. build.ts writes them; the tests call this directly.
import { createHash } from 'node:crypto';
import type { AnyRecord, CaseFile, CaseId, GroundTruth, Manifest } from '../../shared/types';
import { subSeed } from './prng';
import { genA, genB, genC, genD } from './records';
import { buildA } from './caseA';
import { buildB } from './caseB';
import { buildC } from './caseC';
import { buildD } from './caseD';
import { buildFeed } from './feed';
import { CONNECTORS } from './sources';

export const DEFAULT_SEED = 20310304;

export interface GeneratedFile {
  name: string;
  text: string;
  records: number;
}

const GROUND_TRUTH: GroundTruth = {
  simulated: true,
  cases: {
    a: { role: 'SIM-box bypass on one cell', truth: 'A SIM box is operating on the target cell, placing approximately 400 calls over 72 hours to domestic subscribers. In the same window, inbound international traffic on one route is below that route\'s baseline. [FICTION]' },
    b: { role: 'Call-centre lookalike', truth: 'A legitimate call centre with approximately 50 SIMs, all on one cell, generating similar call patterns. No evidence contradicts this explanation; the hypothesis survives. [FICTION]' },
    c: { role: 'IoT/M2M fleet', truth: 'Cellular-connected IoT devices from one vendor sharing a radio footprint with SIM-box indicators. Evidence correlation reveals the lookalike. Case ends as legitimate. [FICTION]' },
    d: { role: 'International revenue share fraud (IRSF) contrast case', truth: 'Revenue-share charges to premium destinations routed through a compromised PBX. Shows that fraud types have different records and require different reasoning. [FICTION]' },
  },
};

export const json = (v: unknown): string => JSON.stringify(v, null, 2) + '\n';

const LABEL = /\b(?:REC|IBCF)-[A-DMN]-\d{6}\b/g;
const FIRST_ID = 4_120_000;

/**
 * One neutral id scheme for every record. The generators label records by stream (REC-A-..., IBCF-N-...), which would
 * name the scenario. Here the whole feed is ranked by answer time (ties broken by a hash of the label, not the label)
 * and each record takes the next number: CR-04120001, CR-04120002 and so on. A scenario record has neighbours from
 * ordinary traffic on both sides; nothing in the id tells them apart. Same seed, same ids.
 */
export function neutralIds(seed: number, records: AnyRecord[]): Map<string, string> {
  const tie = (id: string) => subSeed(seed, `record-order-${id}`);
  const ranked = [...records].sort((a, b) => (a.serviceDeliveryStartTimeStamp < b.serviceDeliveryStartTimeStamp ? -1 : a.serviceDeliveryStartTimeStamp > b.serviceDeliveryStartTimeStamp ? 1 : tie(a.id) - tie(b.id)));
  return new Map(ranked.map((r, i) => [r.id, `CR-${String(FIRST_ID + i + 1).padStart(8, '0')}`]));
}

export function generate(seed: number = DEFAULT_SEED): GeneratedFile[] {
  const built: [CaseId, CaseFile][] = [['a', buildA(seed, genA(seed))], ['b', buildB(seed, genB(seed))], ['c', buildC(seed, genC(seed))], ['d', buildD(seed, genD(seed))]];
  const feed = buildFeed(seed, Object.fromEntries(built) as Record<CaseId, CaseFile>);
  const ids = neutralIds(seed, feed.records);
  const swap = (text: string): string => text.replace(LABEL, (m) => ids.get(m) ?? m);
  const files: GeneratedFile[] = built.map(([id, c]) => ({ name: `case-${id}.json`, text: swap(json(c)), records: c.recordCounts.scscf + c.recordCounts.ibcf }));
  files.push({ name: 'ground-truth.json', text: json(GROUND_TRUTH), records: 0 });
  const ordered = [...feed.records].sort((a, b) => ((ids.get(a.id) as string) < (ids.get(b.id) as string) ? -1 : 1));
  files.push({ name: 'feed.ndjson', text: ordered.map((x) => swap(JSON.stringify(x))).join('\n') + '\n', records: ordered.length });
  files.push({ name: 'connectors.json', text: json(CONNECTORS), records: 0 });
  const manifest: Manifest = {
    simulated: true,
    seed,
    generatedBy: 'seed/build.ts',
    files: files.map((f) => ({ name: f.name, sha256: createHash('sha256').update(f.text).digest('hex'), records: f.records })),
  };
  files.push({ name: 'manifest.json', text: json(manifest), records: 0 });
  return files;
}
