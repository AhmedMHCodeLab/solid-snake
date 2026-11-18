// The bundle is public: a scenario's outcome, the name of a hypothesis bound to a verified result and the ground-truth
// wording must not appear in anything the browser is sent. The same check runs over dist/ at the end of `npm run build`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const run = (...roots: string[]) => spawnSync(process.execPath, ['scripts/check-budget.mjs', '--leaks', ...roots], { cwd: process.cwd(), encoding: 'utf8' });

describe('scenario outcomes stay on the server', () => {
  it('the interface sources and the page shells carry none', () => {
    const r = run('web');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('the built bundle carries none, when it has been built', () => {
    if (!existsSync(join(process.cwd(), 'dist'))) return;
    const r = run('dist');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('the check fails on a planted outcome, a verified hypothesis name and ground-truth wording', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ss-leak-'));
    for (const [i, text] of ['Verified (simulated): a SIM box was found at the marked site.', 'Hypothesis H-A1: SIM-box operation.', 'Case A, stage 3', 'SIM-box bypass on one cell'].entries()) {
      writeFileSync(join(dir, `p${i}.html`), `<p>${text}</p>`);
      const r = run(join(dir, `p${i}.html`));
      expect(r.status, text).toBe(1);
    }
  });
});
