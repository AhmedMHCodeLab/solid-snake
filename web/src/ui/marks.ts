// Pure string builders. No DOM access: they run in Node (prerender) and in the browser.
// Class contract (styles in src/styles/marks.css):
//   .mk                     the level mark SVG; modifiers .mk--l1 .. .mk--l5, .mk--fallen, .mk--awaiting, .mk--unsignable
//   .mk__tick .mk__rule .mk__rule2 .mk__tie .mk__frame .mk__rival .mk__close .mk__sign .mk__strike
//                           one element per stroke, each with data-stroke="<name>". Strokes new since opts.from carry .is-new
//   .lacuna                 the lacuna bracket SVG; parts .lacuna__bracket and .lacuna__slot
import { LEVEL_NAMES, type Level } from '../../../shared/types';

export type MarkState = 'current' | 'fallen' | 'awaiting' | 'unsignable';

export interface MarkOpts {
  /** Pixel size of the square mark, or any CSS length. Default 24. */
  size?: number | string;
  state?: MarkState;
  /** The level held before this render. Strokes that did not exist at that level get the class is-new, for animation. */
  from?: Level | null;
  className?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function levelLabel(level: Level): { numeral: string; name: string; text: string } {
  return { numeral: String(level), name: LEVEL_NAMES[level], text: `Level ${level}, ${LEVEL_NAMES[level]}` };
}

// 48 x 48 sheet. Skeleton at x 8..22 (tick, rule, second rule), frame at 3..44, sign line at 27..41.
// At small sizes (28 px and below) the graduations are coarsened so the rule still reads as a rule.
const ticks = (coarse: boolean) => {
  const ys = coarse ? [8, 16, 24, 32, 40] : [8, 12, 16, 20, 24, 28, 32, 36, 40];
  return ys.map((y) => `M8 ${y}h${coarse || (y - 8) % 8 === 0 ? 7 : 4}`).join('');
};
const ticks2 = (coarse: boolean) => (coarse ? '' : [8, 16, 24, 32, 40].map((y) => `M22 ${y}h4`).join(''));

interface Stroke { name: string; d: string; cls?: string }

/** The stroke list for a level, cumulative: each level keeps what the one below drew. */
function strokesFor(level: Level, state: MarkState, coarse = false): Stroke[] {
  if (state === 'awaiting') return [{ name: 'frame', d: 'M44 3H3V45H44', cls: 'mk__frame--dotted' }];
  const s: Stroke[] = [{ name: 'tick', d: 'M8 22V8H22' }];
  if (level >= 2) s.push({ name: 'rule', d: 'M8 8V40' + ticks(coarse) });
  if (level >= 3) s.push({ name: 'rule2', d: 'M22 8V40' + ticks2(coarse) }, { name: 'tie', d: 'M8 40H22' });
  if (level === 4 || state === 'fallen') {
    s.push({ name: 'frame', d: 'M44 3H3V45H44', cls: state === 'fallen' ? 'mk__frame--broken' : 'mk__frame--dashed' });
    if (state !== 'fallen') s.push({ name: 'rival', d: 'M44 17H47M44 31H47' });
    else s.push({ name: 'strike', d: 'M5 44L43 4' });
  }
  if (level === 5 && state !== 'fallen') {
    s.push({ name: 'frame', d: 'M44 3H3V45H44', cls: 'mk__frame--solid' }, { name: 'close', d: 'M44 3V45' }, { name: 'sign', d: 'M27 37H41' });
  }
  if (state === 'unsignable') s.push({ name: 'sign', d: 'M27 37H37M40 32V42', cls: 'mk__sign--barred' });
  return s;
}

/** Strokes a level adds to the one below. For the contract page and for animation code. */
export const STROKES_BY_LEVEL: Record<Level, string[]> = {
  1: ['tick'],
  2: ['rule'],
  3: ['rule2', 'tie'],
  4: ['frame', 'rival'],
  5: ['frame', 'close', 'sign'],
};

export function levelMark(level: Level, opts: MarkOpts = {}): string {
  const state = opts.state ?? 'current';
  const size = typeof opts.size === 'number' ? `${opts.size}px` : (opts.size ?? '24px');
  const label =
    state === 'fallen' ? `Fallen from level ${level}, ${LEVEL_NAMES[level]}`
    : state === 'awaiting' ? 'Awaiting evidence'
    : state === 'unsignable' ? `Unsignable, held at level ${level}, ${LEVEL_NAMES[level]}`
    : levelLabel(level).text;
  const px0 = typeof opts.size === 'number' ? opts.size : 24;
  const coarse = px0 <= 28;
  const before = opts.from === undefined ? null : new Set(opts.from === null ? [] : strokesFor(opts.from, 'current', coarse).map((s) => s.name));
  const paths = strokesFor(level, state, coarse)
    .map((s) => {
      // The frame changes character from dashed to solid at level 5, so it counts as new when rising 4 to 5.
      const isNew = before !== null && (!before.has(s.name) || (s.name === 'frame' && level === 5 && opts.from === 4));
      return `<path class="mk__${s.name}${s.cls ? ' ' + s.cls : ''}${isNew ? ' is-new' : ''}" data-stroke="${s.name}" d="${s.d}"/>`;
    })
    .join('');
  const px = typeof opts.size === 'number' ? opts.size : 24;
  const sz = px <= 18 ? ' mk--xs' : px <= 28 ? ' mk--sm' : px >= 56 ? ' mk--lg' : '';
  const mod = (state === 'current' ? `mk--l${level}` : `mk--${state} mk--l${level}`) + sz;
  return `<svg class="mk ${mod}${opts.className ? ' ' + esc(opts.className) : ''}" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="${esc(label)}" focusable="false">${paths}</svg>`;
}

export interface LacunaOpts {
  width?: number;
  height?: number;
  /** Appended to the accessible name, for example "inbound sessions on route R". */
  label?: string;
  /** 'paper' draws the slot hatch in graphite, 'wall' in the wall's dim ink. 'wall-light' is only for a page that shows a light wall and a dark wall at once (the design page). */
  surface?: 'paper' | 'wall' | 'wall-light';
  className?: string;
}

/** "Expected, not observed": square brackets around an empty hatched slot. The slot is never filled. */
export function lacunaBracket(opts: LacunaOpts = {}): string {
  const w = opts.width ?? 56;
  const h = opts.height ?? 24;
  const name = opts.label ? `Expected, not observed: ${opts.label}` : 'Expected, not observed';
  const hatch = opts.surface === 'wall' ? 'hs-lacuna-wall' : opts.surface === 'wall-light' ? 'hs-lacuna-wall-lt' : 'hs-lacuna';
  const b = 6;
  return (
    `<svg class="lacuna${opts.className ? ' ' + esc(opts.className) : ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(name)}" focusable="false">` +
    `<rect class="lacuna__slot" x="${b + 3}" y="3" width="${w - 2 * (b + 3)}" height="${h - 6}" fill="url(#${hatch})"/>` +
    `<path class="lacuna__bracket" d="M${b} 1H1V${h - 1}H${b}M${w - b} 1H${w - 1}V${h - 1}H${w - b}"/>` +
    `</svg>`
  );
}

/**
 * The pattern definitions the plates and the lacuna slot refer to. Put them once per document inside a hidden SVG
 * (defsSprite() does that); every inline SVG on the page can then use fill="url(#hs-...)".
 * Ids: hs-region, hs-sector, hs-obs, hs-footprint, hs-band, hs-lacuna, hs-lacuna-wall, hs-lacuna-wall-lt. Line colours come from CSS (map.css).
 */
export function hatchDefs(): string {
  const p = (id: string, size: number, rot: number, lines: string) =>
    `<pattern id="${id}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot})">${lines}</pattern>`;
  const v = (size: number, tone: 'blue' | 'graphite' | 'wall' | 'wall-lt') => `<line class="hs hs--${tone}" x1="0" y1="0" x2="0" y2="${size}"/>`;
  const h = (size: number, tone: 'blue' | 'graphite' | 'wall' | 'wall-lt') => `<line class="hs hs--${tone}" x1="0" y1="0" x2="${size}" y2="0"/>`;
  return (
    '<defs>' +
    p('hs-region', 5, 45, v(5, 'blue')) +
    p('hs-sector', 7, 45, v(7, 'blue')) +
    p('hs-obs', 8, 45, v(8, 'blue') + h(8, 'blue')) +
    p('hs-footprint', 7, -45, v(7, 'graphite')) +
    p('hs-band', 3, 0, v(3, 'blue')) +
    p('hs-lacuna', 4, 45, v(4, 'graphite')) +
    p('hs-lacuna-wall', 4, 45, v(4, 'wall')) +
    p('hs-lacuna-wall-lt', 4, 45, v(4, 'wall-lt')) +
    '</defs>'
  );
}

/** A zero-size hidden SVG that carries hatchDefs(). Emit once, near the top of the body. */
export function defsSprite(): string {
  return `<svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">${hatchDefs()}</svg>`;
}

/**
 * The mask that darkens everything on a plate except the pool of light. Put it inside the plate's SVG <defs> and give a
 * veil rect mask="url(#id)". The pool is driven by --spot-x, --spot-y and --spot-r on the SVG (see spotlight.css).
 */
export function spotMask(id: string, w: number, h: number): string {
  return (
    `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="#fff"/><circle class="spot__penumbra" fill="#808080"/><circle class="spot__pool" fill="#000"/></mask>`
  );
}
