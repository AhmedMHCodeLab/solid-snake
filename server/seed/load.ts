// Test helper: reads data/generated/ when it exists, otherwise runs the generator in memory.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseFile, CaseId, GroundTruth, Manifest } from '../../shared/types';
import { DEFAULT_SEED, generate } from './generate';

export interface Loaded {
  cases: Record<CaseId, CaseFile>;
  truth: GroundTruth;
  manifest: Manifest;
  texts: Record<string, string>;
  fromDisk: boolean;
}

export const CASE_IDS: CaseId[] = ['a', 'b', 'c', 'd'];

let cache: Loaded | null = null;
export function loadGenerated(): Loaded {
  if (cache) return cache;
  const dir = join(process.cwd(), 'data', 'generated');
  const fromDisk = existsSync(join(dir, 'manifest.json')) && ['case-a', 'case-b', 'case-c', 'case-d', 'ground-truth', 'connectors'].every((n) => existsSync(join(dir, `${n}.json`)));
  const texts: Record<string, string> = {};
  if (fromDisk) for (const n of [...CASE_IDS.map((c) => `case-${c}.json`), 'ground-truth.json', 'connectors.json', 'manifest.json']) texts[n] = readFileSync(join(dir, n), 'utf8');
  else for (const f of generate(DEFAULT_SEED)) texts[f.name] = f.text;
  const cases = Object.fromEntries(CASE_IDS.map((c) => [c, JSON.parse(texts[`case-${c}.json`] as string)])) as Record<CaseId, CaseFile>;
  cache = { cases, truth: JSON.parse(texts['ground-truth.json'] as string), manifest: JSON.parse(texts['manifest.json'] as string), texts, fromDisk };
  return cache;
}
