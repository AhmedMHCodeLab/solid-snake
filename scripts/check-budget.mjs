// Budget check over dist/ (run after `vite build`). For each page: the gzipped JavaScript it loads at first paint,
// meaning its module entry, every modulepreload, and every static import those chunks make. Dynamic import() is not
// first load and is not counted. Fails over 150 KB per page, if the entry or About page carries GSAP, or if the
// woff2 fonts exceed 200 KB.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';


// ---- Leak check: nothing the workflow has not earned may ship in a page, a script or a stylesheet ----------------------------
// The bundle is public. A scenario's outcome, the name of a hypothesis bound to a verified result and the ground-truth
// wording belong to the server, released step by step to an analyst who has done the work. Patterns come from the generated
// data when it exists, plus a fixed list of the forms the interface once carried.
const FIXED = [/\bCase [A-D]\b/, /\bSS-[A-D]\b/, /\bH-[A-D][0-9]\b/, /\b(?:REC|IBCF)-[A-DMN]-\d{6}\b/, /\bSH-[A-D]-/, /found one installed SIM box/i, /a SIM box was found/i, /A box was found/i, /SIM-box operation/i];
function dataPatterns() {
  const out = [];
  const gt = resolve('data/generated/ground-truth.json');
  if (existsSync(gt)) {
    for (const c of Object.values(JSON.parse(readFileSync(gt, 'utf8')).cases)) out.push(c.role, c.truth.replace(/\s*\[FICTION\]\s*$/, ''));
  }
  for (const id of ['a', 'b', 'c', 'd']) {
    const f = resolve(`data/generated/case-${id}.json`);
    if (!existsSync(f)) continue;
    const c = JSON.parse(readFileSync(f, 'utf8'));
    for (const h of c.hypotheses) {
      const verified = h.versions.filter((v) => v.state === 'verified');
      if (verified.length) out.push(h.name, ...verified.map((v) => v.statement));
    }
  }
  return [...new Set(out)].filter((x) => x && x.length > 8);
}
function textFiles(root) {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return [root];
  return readdirSync(root, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? textFiles(join(root, e.name)) : /\.(html|js|mjs|css|ts|json|svg)$/.test(e.name) ? [join(root, e.name)] : []));
}
export function scenarioLeaks(roots) {
  const words = dataPatterns();
  const hits = [];
  for (const f of roots.flatMap(textFiles)) {
    const text = readFileSync(f, 'utf8');
    for (const re of FIXED) if (re.test(text)) hits.push(`${f}: ${re}`);
    for (const w of words) if (text.includes(w)) hits.push(`${f}: "${w.slice(0, 60)}"`);
  }
  return hits;
}
if (process.argv[2] === '--leaks') {
  const hits = scenarioLeaks(process.argv.slice(3));
  for (const h of hits) console.error(`LEAK ${h}`);
  console.log(hits.length ? `Leak check failed: ${hits.length} hit(s).` : 'Leak check passed.');
  process.exit(hits.length ? 1 : 0);
}

const dist = resolve(process.argv[2] ?? 'dist');
const LIMIT_JS = 150 * 1024;
const LIMIT_FONTS = 200 * 1024;
const pages = ['index.html', 'console/index.html', 'about/index.html', 'system/index.html'];
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
let failed = false;

function chunkGraph(entries) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file) || !existsSync(file)) return;
    seen.add(file);
    const src = readFileSync(file, 'utf8');
    // static imports only: `import x from "./a.js"`, `import "./a.js"`, `export * from "./a.js"`, minified forms included
    for (const m of src.matchAll(/(?:^|[;\s}])(?:import|export)\s*(?:[^'"()]*?\sfrom\s*)?["']([^"']+\.js)["']/g)) walk(resolve(dirname(file), m[1]));
  };
  entries.forEach(walk);
  return [...seen];
}

for (const page of pages) {
  const html = join(dist, page);
  if (!existsSync(html)) { console.log(`${page}: not built`); continue; }
  const text = readFileSync(html, 'utf8');
  const refs = [...text.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g), ...text.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  const files = chunkGraph(refs.map((r) => (r.startsWith('/') ? join(dist, r) : resolve(dirname(html), r))));
  const gz = files.reduce((n, f) => n + gzipSync(readFileSync(f), { level: 9 }).length, 0);
  const gsap = files.some((f) => /GreenSock|gsap\.com/.test(readFileSync(f, 'utf8')));
  const over = gz > LIMIT_JS;
  const gsapWhereBanned = gsap && (page === 'index.html' || page === 'about/index.html');
  console.log(`${page}: ${files.length} chunk(s), ${kb(gz)} gzipped first-load JS${gsap ? ', includes GSAP' : ', no GSAP'}${over ? '  OVER 150 KB' : ''}${gsapWhereBanned ? '  GSAP NOT ALLOWED HERE' : ''}`);
  if (over || gsapWhereBanned) failed = true;
}

const assets = join(dist, 'assets');
const fonts = existsSync(assets) ? readdirSync(assets).filter((f) => f.endsWith('.woff2')) : [];
const fontBytes = fonts.reduce((n, f) => n + statSync(join(assets, f)).size, 0);
console.log(`fonts: ${fonts.length} woff2 file(s), ${kb(fontBytes)} (limit 200 KB)${fontBytes > LIMIT_FONTS ? '  OVER' : ''}`);
for (const f of fonts) console.log(`  ${f}: ${kb(statSync(join(assets, f)).size)}`);
if (fontBytes > LIMIT_FONTS) failed = true;

const leaks = scenarioLeaks([dist]);
for (const h of leaks) console.error(`LEAK ${h}`);
console.log(`leak check over ${dist}: ${leaks.length ? `${leaks.length} hit(s)` : 'no scenario outcome, no verified-hypothesis name, no ground-truth wording'}`);
if (leaks.length) failed = true;

if (failed) { console.error('Budget check failed.'); process.exit(1); }
console.log('Budget check passed.');
