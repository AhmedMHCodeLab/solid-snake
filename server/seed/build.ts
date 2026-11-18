// npm run seed [-- --seed N]: writes data/generated/*.json. Same seed, same bytes.
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SEED, generate } from './generate';

const i = process.argv.indexOf('--seed');
const seed = i >= 0 ? Number(process.argv[i + 1]) : DEFAULT_SEED;
if (!Number.isInteger(seed)) throw new Error('--seed needs an integer');

const dir = join(process.cwd(), 'data', 'generated');
mkdirSync(dir, { recursive: true });
const files = generate(seed);
// Manifest last, each file written then renamed so a reader never sees a partial file.
for (const f of files) {
  const tmp = join(dir, `${f.name}.tmp`);
  writeFileSync(tmp, f.text);
  renameSync(tmp, join(dir, f.name));
}
console.log(`seed ${seed}: wrote ${files.length} files to data/generated/`);
for (const f of files) console.log(`  ${f.name}  ${f.text.length} bytes${f.records ? `  ${f.records} records` : ''}`);
