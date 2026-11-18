// Pure string helpers shared by the prerender (Node) and the browser. No DOM access.
import { LEVEL_NAMES, type Basis, type CaseSummary, type Level, type SourceCode } from '../../../shared/types';
import { lacunaBracket, levelLabel, levelMark } from '../ui/marks';

export const esc = (s: string | number) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** A value quoted from a record: mono inside serif prose. */
export const v = (s: string | number) => `<span class="v${String(s).length > 22 ? ' v--wrap' : ''}">${esc(s)}</span>`;
/** A reference number (source code, entry id), cited after the plain name the way a report cites an exhibit. */
export const ref = (s: string) => `<span class="ref">${esc(s)}</span>`;

export const HANDLING = 'SIMULATED // EXERCISE DATA';
export const ABOUT_LINE = 'A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners.';

export const handling = (where: 'top' | 'bottom' | 'plate', text = HANDLING) =>
  `<p class="simulated handling handling--${where}">${esc(text)}</p>`;

export function levelline(level: Level, size = 18, hyp = level === 4): string {
  const l = levelLabel(level);
  return `<span class="levelline${hyp ? ' levelline--hyp' : ''}">${levelMark(level, { size })}<span class="levelline__num">${l.numeral}</span><span class="levelline__name">${esc(l.name)}</span></span>`;
}
/** The level as text only, for places where the mark is already drawn. */
export const levelText = (level: Level) => `Level ${level}, ${LEVEL_NAMES[level]}`;
export const basisLabel = (b: Basis) => `<span class="basis" data-basis="${b}">${b}</span>`;
export const lacuna = (label?: string, surface: 'paper' | 'wall' = 'paper', w = 40, h = 20) => lacunaBracket({ width: w, height: h, surface, label });

/** Plain name of a source first, its code after it as a reference. */
type Sources = { sources: { code: string; name: string; plainName?: string }[] };
export function sourceName(c: Sources, code: SourceCode | string): string {
  const s = c.sources.find((x) => x.code === code);
  return s ? s.plainName ?? s.name : String(code);
}
export const sourceCite = (c: Sources, code: SourceCode | string) => `${esc(sourceName(c, code))} ${ref(String(code))}`;

export const date = (iso: string) => iso.slice(0, 10);
export const windowText = (w: { start: string; end: string }) => `${date(w.start)} to ${date(w.end)}`;
export const hoursIn = (w: { start: string; end: string }) => Math.round((Date.parse(w.end) - Date.parse(w.start)) / 3_600_000);
export const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
export const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-GB') : String(+n.toFixed(3)));

/** First n ids and a count of the rest. Long evidence lists are summarised, never dropped silently. */
export function idList(ids: string[], n = 4): string {
  if (!ids.length) return '';
  const shown = ids.slice(0, n).map((i) => v(i)).join(', ');
  return ids.length > n ? `${shown} and ${num(ids.length - n)} more (${num(ids.length)} in all)` : shown;
}

/** Operators and carriers: the plain first-layer name ("Operator 1") replaces the minimised id ("MNO-1"). */
export function plainEntities(c: Pick<CaseSummary, 'entities'>, text: string): string {
  let t = text;
  for (const e of c.entities ?? []) t = t.split(e.id).join(e.plainName);
  return t;
}

/**
 * Running text with glossary terms marked. Each term found carries its one-sentence explanation as a described-by
 * tooltip that opens on hover, focus and tap with no animation. Input is plain text; output is escaped HTML.
 */
export function prose(c: Pick<CaseSummary, 'glossary' | 'entities'>, text: string, idp: string): string {
  const t = plainEntities(c, text);
  const terms = (c.glossary ?? []).flatMap((g, gi) => [g.plain, g.term].filter(Boolean).map((w) => ({ w, g, gi })));
  const hits: { at: number; len: number; gi: number }[] = [];
  const seen = new Set<number>();
  for (const { w, gi } of terms.sort((a, b) => b.w.length - a.w.length)) {
    if (seen.has(gi)) continue;
    const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const m = re.exec(t);
    if (!m) continue;
    if (hits.some((h) => m.index < h.at + h.len && h.at < m.index + m[0].length)) continue;
    hits.push({ at: m.index, len: m[0].length, gi });
    seen.add(gi);
  }
  hits.sort((a, b) => a.at - b.at);
  let out = '';
  let i = 0;
  for (const h of hits) {
    const g = c.glossary![h.gi]!;
    const id = `${idp}-g${h.gi}`;
    out += esc(t.slice(i, h.at)) + `<span class="term"><button type="button" class="term__w" aria-describedby="${id}">${esc(t.slice(h.at, h.at + h.len))}</button><span class="term__tip" role="tooltip" id="${id}">${esc(g.explain)}</span></span>`;
    i = h.at + h.len;
  }
  return out + esc(t.slice(i));
}

export const STAGE_LEDES: Record<number, string> = {
  1: 'Records arrive after the calls were made. Something in them stands out against what is normal.',
  2: 'Each source says what it saw, and what it did not. The area of uncertainty changes as each one is added.',
  3: 'More than one explanation fits. Each is set out with what would support or refute it.',
  4: 'Evidence from outside the analysis arrives. A claim rises, holds or falls in full view.',
  5: 'Only a verified finding can be signed. Signing records a judgement and changes no level.',
  6: 'The packet goes up a chain of simulated roles. Nothing leaves this application.',
  7: 'What the evidence established, what it only suggests, and what is still unknown.',
};
