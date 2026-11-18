// Plate geometry. Pure functions: world coordinates, paths, interpolation and cameras.
// National plate: SVG units from src/generated/qatar.ts (projectLonLat). Case plate: 100 units per km on the case grid.
import { projectLonLat } from '../generated/qatar';
import type { MapShape, Plate, Point } from '../../../shared/types';

export const CASE_UNITS = 100;
export type XY = [number, number];
export interface Rect { x: number; y: number; w: number; h: number }

export function toWorld(plate: Plate, p: Point): XY {
  return plate === 'national' ? projectLonLat(p) : [p[0] * CASE_UNITS, p[1] * CASE_UNITS];
}
export const shapeWorld = (s: MapShape): XY[] => s.points.map((p) => toWorld(s.plate, p));

export function pathOf(pts: XY[]): string {
  if (!pts.length) return '';
  let d = `M${pts[0]![0].toFixed(1)} ${pts[0]![1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i]![0].toFixed(1)} ${pts[i]![1].toFixed(1)}`;
  return d + 'Z';
}

/** Point-by-point interpolation. Areas always carry the same point count, so this never collapses an area to a point. */
export function lerpPts(a: XY[], b: XY[], t: number): XY[] {
  if (a.length !== b.length) return t < 0.5 ? a : b;
  return a.map((p, i) => [p[0] + (b[i]![0] - p[0]) * t, p[1] + (b[i]![1] - p[1]) * t]);
}

export function bbox(pts: XY[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};
export const pad = (r: Rect, f: number, min = 0): Rect => {
  const w = Math.max(r.w * (1 + 2 * f), min), h = Math.max(r.h * (1 + 2 * f), min);
  return { x: r.x + r.w / 2 - w / 2, y: r.y + r.h / 2 - h / 2, w, h };
};
export const centre = (r: Rect): XY => [r.x + r.w / 2, r.y + r.h / 2];

/** Camera interpolation: centre linearly, size geometrically, so a zoom feels even. */
export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  const g = (p: number, q: number) => Math.exp(Math.log(p) + (Math.log(q) - Math.log(p)) * t);
  const [ax, ay] = centre(a), [bx, by] = centre(b);
  const w = g(a.w, b.w), h = g(a.h, b.h);
  return { x: ax + (bx - ax) * t - w / 2, y: ay + (by - ay) * t - h / 2, w, h };
}

/** Uniform fit of a world rect into a screen rect: returns scale and translation. */
export function fit(world: Rect, screen: Rect): { k: number; tx: number; ty: number } {
  const k = Math.min(screen.w / world.w, screen.h / world.h);
  return { k, tx: screen.x + (screen.w - world.w * k) / 2 - world.x * k, ty: screen.y + (screen.h - world.h * k) / 2 - world.y * k };
}

export function polyArea(pts: XY[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i]!, q = pts[(i + 1) % pts.length]!; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a / 2);
}
/** A label anchor on the edge of an area: its upper right, so the tag never sits on top of the hatching. */
export const anchorOf = (r: Rect): XY => [r.x + r.w, r.y];

export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // power3.inOut, for scrubbed segments
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
