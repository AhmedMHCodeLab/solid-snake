// Reproducibility: same seed, same bytes; a different seed, different records.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CaseFile } from '../shared/types';
import { DEFAULT_SEED, generate } from '../server/seed/generate';
import { loadGenerated } from '../server/seed/load';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const hashes = (seed: number) => Object.fromEntries(generate(seed).map((f) => [f.name, sha(f.text)]));

describe('reproducibility', () => {
  const first = generate(DEFAULT_SEED);
  const second = generate(DEFAULT_SEED);

  it('generating twice with the same seed gives identical bytes for every file', () => {
    expect(second.map((f) => f.name)).toEqual(first.map((f) => f.name));
    for (const f of first) expect(sha((second.find((x) => x.name === f.name) as { text: string }).text), f.name).toBe(sha(f.text));
  });

  it('the manifest holds the seed and the sha256 of every other file', () => {
    const m = JSON.parse((first.find((f) => f.name === 'manifest.json') as { text: string }).text);
    expect(m.simulated).toBe(true);
    expect(m.seed).toBe(DEFAULT_SEED);
    for (const f of m.files) expect(f.sha256).toBe(sha((first.find((x) => x.name === f.name) as { text: string }).text));
    expect(m.files.map((f: { name: string }) => f.name)).toEqual(['case-a.json', 'case-b.json', 'case-c.json', 'case-d.json', 'ground-truth.json', 'feed.ndjson', 'connectors.json']);
  });

  it('files use 2-space indent, a trailing newline and no negative zero', () => {
    for (const f of first) {
      expect(f.text.endsWith('\n')).toBe(true);
      if (f.name === 'feed.ndjson') expect(f.text.startsWith('{"simulated":true,')).toBe(true);
      else if (f.name === 'connectors.json') expect(f.text.startsWith('[\n  {')).toBe(true);
      else {
        expect(f.text.endsWith('}\n')).toBe(true);
        expect(f.text.startsWith('{\n  "')).toBe(true);
      }
      expect(/[:\s[,]-0(?:[,\s\]}]|$)/.test(f.text), f.name).toBe(false);
    }
  });

  it('a different seed gives different records in every case', () => {
    const other = generate(DEFAULT_SEED + 1);
    const feedA = first.find((f) => f.name === 'feed.ndjson')!.text;
    const feedB = other.find((f) => f.name === 'feed.ndjson')!.text;
    expect(sha(feedA)).not.toBe(sha(feedB));
    for (const id of ['a', 'b', 'c', 'd']) {
      const a = JSON.parse((first.find((f) => f.name === `case-${id}.json`) as { text: string }).text) as CaseFile;
      const b = JSON.parse((other.find((f) => f.name === `case-${id}.json`) as { text: string }).text) as CaseFile;
      expect(sha(JSON.stringify(a.records)), id).not.toBe(sha(JSON.stringify(b.records)));
      expect(a.records.scscf.map((r) => r.serviceRequestTimeStamp)).not.toEqual(b.records.scscf.map((r) => r.serviceRequestTimeStamp));
    }
    expect(hashes(DEFAULT_SEED + 1)['manifest.json']).not.toBe(hashes(DEFAULT_SEED)['manifest.json']);
  });

  it('data/generated, when present, matches what the generator produces for its own seed', () => {
    const l = loadGenerated();
    if (!l.fromDisk) return;
    const regenerated = generate(l.manifest.seed);
    for (const f of regenerated) expect(sha(l.texts[f.name] ?? readFileSync(join('data', 'generated', f.name), 'utf8')), `${f.name} on disk is stale: run npm run seed`).toBe(sha(f.text));
  });

  it('nothing in server/seed/ reads the wall clock or unseeded randomness', () => {
    for (const name of readdirSync(join('server', 'seed'))) {
      if (!name.endsWith('.ts')) continue;
      const src = readFileSync(join('server', 'seed', name), 'utf8');
      expect(src, name).not.toMatch(/Math\.random|Date\.now|new Date\(\)|performance\.now|process\.hrtime/);
    }
  });
});
