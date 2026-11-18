// Map geometry. Every area is resampled to exactly AREA_POINTS points: clockwise (north up), starting at the
// north-most vertex, equal steps along the perimeter. Any two areas can then be interpolated point by point.
import { AREA_POINTS } from '../../shared/types';
import type { Point } from '../../shared/types';
import { r } from './prng';
import type { Rng } from './prng';

export const MIN_AREA_KM2 = 0.05;
const KM_PER_DEG_LAT = 110.57;
const kmPerDegLon = (lat: number): number => 111.32 * Math.cos((lat * Math.PI) / 180);

export function signedArea(p: Point[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const a = p[i] as Point;
    const b = p[(i + 1) % p.length] as Point;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

export const polyArea = (p: Point[]): number => Math.abs(signedArea(p));

/** Area in km2 of a [longitude, latitude] polygon (equirectangular at the polygon's mean latitude). */
export function geoAreaKm2(p: Point[]): number {
  const lat0 = p.reduce((s, q) => s + q[1], 0) / p.length;
  const km: Point[] = p.map((q) => [q[0] * kmPerDegLon(lat0), q[1] * KM_PER_DEG_LAT]);
  return polyArea(km);
}

export function resample(poly: Point[], dp: number, n: number = AREA_POINTS): Point[] {
  let pts = poly.slice();
  if (signedArea(pts) > 0) pts.reverse(); // y is north: negative signed area is clockwise on a north-up map
  let start = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i] as Point;
    const b = pts[start] as Point;
    if (a[1] > b[1] || (a[1] === b[1] && a[0] < b[0])) start = i;
  }
  pts = pts.slice(start).concat(pts.slice(0, start));
  const m = pts.length;
  const cum: number[] = [0];
  for (let i = 0; i < m; i++) {
    const a = pts[i] as Point;
    const b = pts[(i + 1) % m] as Point;
    cum.push((cum[i] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = cum[m] as number;
  const out: Point[] = [];
  let seg = 0;
  for (let k = 0; k < n; k++) {
    const d = (k * total) / n;
    while (seg < m - 1 && (cum[seg + 1] as number) < d) seg++;
    const a = pts[seg] as Point;
    const b = pts[(seg + 1) % m] as Point;
    const len = (cum[seg + 1] as number) - (cum[seg] as number);
    const t = len === 0 ? 0 : (d - (cum[seg] as number)) / len;
    out.push([r(a[0] + (b[0] - a[0]) * t, dp), r(a[1] + (b[1] - a[1]) * t, dp)]);
  }
  return out;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
/** Bearing in degrees clockwise from north. */
const at = (apex: Point, bearing: number, dist: number): Point => [apex[0] + dist * Math.sin(rad(bearing)), apex[1] + dist * Math.cos(rad(bearing))];

/** A wedge: apex, then the arc from the start bearing to the end bearing. Also used for a fan of adjacent sectors. */
export function fanPoly(apex: Point, azFrom: number, azTo: number, rangeKm: number): Point[] {
  const out: Point[] = [apex];
  const steps = 48;
  for (let i = 0; i <= steps; i++) out.push(at(apex, azFrom + ((azTo - azFrom) * i) / steps, rangeKm));
  return out;
}

export const sectorPoly = (apex: Point, az: number, bw: number, rangeKm: number): Point[] => fanPoly(apex, az - bw / 2, az + bw / 2, rangeKm);

/** Arc band between two distances from the antenna, inside the sector. */
export function bandPoly(apex: Point, az: number, bw: number, r1: number, r2: number): Point[] {
  const out: Point[] = [];
  const steps = 32;
  for (let i = 0; i <= steps; i++) out.push(at(apex, az - bw / 2 + (bw * i) / steps, r2));
  for (let i = steps; i >= 0; i--) out.push(at(apex, az - bw / 2 + (bw * i) / steps, r1));
  return out;
}

/** Smooth irregular blob around a centre, in km. */
export function blobPoly(cx: number, cy: number, rx: number, ry: number, rng: Rng, jitter = 0.12): Point[] {
  const ph = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
  const out: Point[] = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n;
    const k = 1 + jitter * (Math.sin(2 * th + (ph[0] as number)) / 2 + Math.sin(3 * th + (ph[1] as number)) / 3 + Math.sin(4 * th + (ph[2] as number)) / 4);
    out.push([cx + rx * k * Math.sin(th), cy + ry * k * Math.cos(th)]);
  }
  return out;
}

/** Blob in kilometres converted to [longitude, latitude] around a centre. */
export function geoBlob(lon0: number, lat0: number, rxKm: number, ryKm: number, rng: Rng): Point[] {
  return blobPoly(0, 0, rxKm, ryKm, rng, 0.14).map((p): Point => [lon0 + p[0] / kmPerDegLon(lat0), lat0 + p[1] / KM_PER_DEG_LAT]);
}

export function pointInPoly(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Point;
    const b = poly[j] as Point;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export const polar = at;
