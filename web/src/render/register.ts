// The evidence register: every entry of a case in five registers by level, the fallen, and the collection gaps.
// A pure function of the case view and the released step. The register an entry sits in is its level.
import { LEVEL_NAMES, type Level } from '../../../shared/types';
import { levelMark } from '../ui/marks';
import { entryStatus, gapState, type Model, type ModelEntry } from './model';
import { cap, esc, idList, lacuna, levelText, ref, sourceName } from './util';

export interface RegisterCounts { byLevel: Record<Level, number>; fallen: number; gaps: number; total: number }

/** What each platform check means, in plain words. The codes themselves are never shown. */
const ISSUE_WORDS: Record<string, string> = {
  'no-open-rival': 'Its only alternative has been ruled out; it stays a hypothesis until an independent check returns.',
  'not-formulated': 'It is not yet a hypothesis: it needs evidence it rests on, a rival explanation, and what would support and refute it.',
  'evidence-not-present': 'Some of the evidence it cites has not been released to this case yet.',
  'verified-without-outside-source': 'It is recorded as verified, but nothing from outside the analysis backs that, so it stays a hypothesis.',
  'fallen-without-evidence': 'It is recorded as fallen, but no released evidence contradicts it, so it stays open.',
};

function entryBody(m: Model, e: ModelEntry, step: number): string {
  const vs = e.versions.filter((v) => v.step <= step);
  const rule = (id?: string) => (id ? m.rules.find((r) => r.id === id) : undefined);
  const issues = e.server?.issues.length ? `<p class="entry__vmeta entry__issues"><b>Platform check:</b> ${e.server.issues.map((i) => esc(ISSUE_WORDS[i] ?? 'The platform could not confirm this entry against the released evidence.')).join(' ')}</p>` : '';
  return `${issues}<ol class="entry__versions">${vs
    .map((v) => {
      const r = rule(v.ruleId);
      const ind = v.independenceId ? m.independence.find((i) => i.id === v.independenceId) : undefined;
      return `<li class="entry__version">
        <p class="entry__vhead">${v.level ? `Level ${v.level}, ${esc(LEVEL_NAMES[v.level])}` : `No longer holds`}</p>
        <p class="entry__vtext${e.kind === 'hypothesis' && v.level === 4 ? ' t-hyp' : ''}">${esc(v.statement)}</p>
        <p class="entry__vmeta">Evidence: ${idList(v.evidence, 6)}${v.evidenceCount > v.evidence.length ? ` and ${v.evidenceCount - v.evidence.length} more (${v.evidenceCount} in all)` : ''}</p>
        ${r ? `<p class="entry__vmeta">Rule: ${esc(r.name)} ${ref(r.id)} <span class="basis" data-basis="${r.basis}">${r.basis}</span></p>` : ''}
        ${v.sources?.length ? `<p class="entry__vmeta">Sources: ${v.sources.map((s) => `${esc(sourceName(m, s))} ${ref(s)}`).join(', ')}</p>` : ''}
        ${ind ? `<p class="entry__vmeta entry__indep">${esc(ind.statement)}</p>` : ''}
      </li>`;
    })
    .join('')}</ol>`;
}

export function registerCounts(m: Model, step: number): RegisterCounts {
  const byLevel = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<Level, number>;
  let fallen = 0;
  for (const e of m.entries) {
    const s = entryStatus(e, step);
    if (s.kind === 'current') byLevel[s.level]++;
    else if (s.kind === 'fallen') fallen++;
  }
  const gaps = m.expectations.filter((x) => gapState(x, step) === 'not-observed').length;
  return { byLevel, fallen, gaps, total: Object.values(byLevel).reduce((a, b) => a + b, 0) + fallen };
}

/** The register body. idp keeps ids unique when the page holds more than one. */
export function registerHTML(m: Model, step: number, idp = 'reg'): string {
  const levels: Level[] = [5, 4, 3, 2, 1];
  const st = m.entries.map((e) => ({ e, s: entryStatus(e, step) }));
  const k = registerCounts(m, step);
  const row = (e: ModelEntry, meta: string, cls: string, mark: string) =>
    `<li class="entry ${cls}${e.kind === 'hypothesis' ? ' entry--hyp' : ''}" data-flip-id="${esc(e.id)}" data-entry="${esc(e.id)}">
      <details class="entry__d"><summary class="entry__link"><span class="entry__id">${esc(e.id)}</span><span class="entry__title">${esc(cap(e.title))}</span>${mark ? `<span class="entry__mark">${mark}</span>` : ''}<span class="entry__meta">${meta}</span></summary>
      <div class="entry__more">${entryBody(m, e, step)}</div></details></li>`;
  const regs = levels
    .map((l) => {
      const items = st.filter((x) => x.s.kind === 'current' && x.s.level === l);
      return `<div role="group" class="register" aria-labelledby="${idp}-r${l}" data-level="${l}">
        <h3 class="register__head" id="${idp}-r${l}"><span class="register__mark">${levelMark(l, { size: 20 })}</span><span class="register__num">${l}</span><span class="register__name">${esc(LEVEL_NAMES[l])}</span><span class="register__count">${items.length}</span></h3>
        ${items.length ? `<ol class="register__list">${items.map((x) => row(x.e, esc(levelText(l)), '', '')).join('')}</ol>` : '<p class="register__none">None yet</p>'}
      </div>`;
    })
    .join('');
  const fallen = st.filter((x) => x.s.kind === 'fallen');
  const fallenReg = `<div role="group" class="register register--fallen" aria-labelledby="${idp}-rf">
    <h3 class="register__head" id="${idp}-rf"><span class="register__mark">${levelMark(4, { size: 20, state: 'fallen' })}</span><span class="register__num">&times;</span><span class="register__name">No longer holds</span><span class="register__count">${fallen.length}</span></h3>
    ${fallen.length ? `<ol class="register__list">${fallen.map((x) => row(x.e, `Struck by new evidence &middot; was <span class="v">${x.s.kind === 'fallen' ? x.s.was : ''}</span>`, 'entry--fallen entry--struck', levelMark(4, { size: 18, state: 'fallen' }))).join('')}</ol>` : '<p class="register__none">None</p>'}
  </div>`;
  const gaps = m.expectations.filter((x) => gapState(x, step) !== 'none' && gapState(x, step) !== 'withdrawn');
  const gapReg = `<div role="group" class="register register--lacuna" aria-labelledby="${idp}-rg" id="${idp}-gaps">
    <h3 class="register__head" id="${idp}-rg"><span class="register__mark">${lacuna(undefined, 'paper', 30, 18)}</span><span class="register__name">Collection gaps: expected, not observed</span><span class="register__count">${k.gaps}</span></h3>
    ${gaps.length ? `<ol class="register__list">${gaps
      .map((x) => {
        const s = gapState(x, step);
        return `<li class="entry entry--lacuna${s === 'observed' ? ' entry--returned' : ''}" data-flip-id="${esc(x.id)}" data-gap="${esc(x.id)}"><details class="entry__d"><summary class="entry__link" tabindex="0"><span class="entry__id">${esc(x.id)}</span><span class="entry__title">${esc(x.what)}</span><span class="entry__meta">${s === 'observed' ? 'Returned later' : `Expected from ${esc(sourceName(m, x.fromSource))} ${ref(x.fromSource)}, not observed`}</span></summary>
          <div class="entry__more"><p class="entry__vmeta">Limits ${x.limits.map((l) => ref(l)).join(', ')}. Rule ${ref(x.ruleId)}.</p></div></details></li>`;
      })
      .join('')}</ol>` : '<p class="register__none">None yet</p>'}
  </div>`;
  return regs + fallenReg + gapReg;
}

export function tallyHTML(m: Model, step: number): string {
  const k = registerCounts(m, step);
  return `<div class="tally" role="group" aria-label="Entries per level">${([1, 2, 3, 4, 5] as Level[]).map((l) => `<div class="tally__cell"><span class="tally__n">${k.byLevel[l]}</span><span class="tally__k">L${l}<span class="sr-only"> ${esc(LEVEL_NAMES[l])}</span></span></div>`).join('')}<div class="tally__cell"><span class="tally__n">${k.gaps}</span><span class="tally__k">Gaps</span></div></div>`;
}
