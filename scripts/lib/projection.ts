// Build-time only (Node). The browser never imports this file or d3-geo: scripts/build-map.ts
// bakes the results into web/src/generated/qatar.ts.
import { readFileSync } from 'node:fs';
import { geoGraticule, geoMercator, geoPath } from 'd3-geo';
import type { Feature, FeatureCollection, Polygon } from 'geojson';

/** Portrait plate with a wide margin: recipient rails, the scale bar, the north mark and labels sit in it. */
export const NATIONAL_VIEWBOX = { x: 0, y: 0, w: 800, h: 1000, attr: '0 0 800 1000' } as const;
/** Where the peninsula is allowed to sit inside the viewBox: [[x0, y0], [x1, y1]]. */
const FIT: [[number, number], [number, number]] = [[200, 130], [600, 850]];

const fc = JSON.parse(readFileSync(new URL('../../data/geo/qatar-ne10m.geojson', import.meta.url), 'utf8')) as FeatureCollection<Polygon>;
const qatar = fc.features.find((f) => f.properties?.ADM0_A3 === 'QAT') as Feature<Polygon>;
if (!qatar) throw new Error('data/geo/qatar-ne10m.geojson has no QAT feature');

const projection = geoMercator().fitExtent(FIT, qatar);
const path = geoPath(projection).digits(1);

export function projectNational([lon, lat]: [number, number]): [number, number] {
  const p = projection([lon, lat]);
  if (!p) throw new Error(`cannot project ${lon},${lat}`);
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}

export function qatarPathD(): string {
  return path(qatar) ?? '';
}

/** Minor graticule every 0.25 degrees, clipped to the viewBox. */
export function graticulePathD(): string {
  const clipped = geoMercator().fitExtent(FIT, qatar).clipExtent([[0, 0], [NATIONAL_VIEWBOX.w, NATIONAL_VIEWBOX.h]]);
  const g = geoGraticule().step([0.25, 0.25]).extent([[49, 23], [54, 28]]);
  return geoPath(clipped).digits(1)(g()) ?? '';
}

/** Edge labels for the graticule: longitude along the bottom margin, latitude along the left margin. */
export function graticuleLabels(): { axis: 'lon' | 'lat'; deg: number; x: number; y: number }[] {
  const out: { axis: 'lon' | 'lat'; deg: number; x: number; y: number }[] = [];
  const [cx, cy] = [(FIT[0][0] + FIT[1][0]) / 2, (FIT[0][1] + FIT[1][1]) / 2];
  const centre = projection.invert!([cx, cy])!;
  for (let lon = 50.5; lon <= 52.01; lon += 0.5) {
    const [x] = projectNational([lon, centre[1]]);
    if (x > 20 && x < 780) out.push({ axis: 'lon', deg: Math.round(lon * 100) / 100, x, y: NATIONAL_VIEWBOX.h - 18 });
  }
  for (let lat = 24.5; lat <= 26.51; lat += 0.5) {
    const [, y] = projectNational([centre[0], lat]);
    if (y > 20 && y < 980) out.push({ axis: 'lat', deg: Math.round(lat * 100) / 100, x: 18, y });
  }
  return out;
}

/**
 * Mercator is separable, so the browser needs no d3: x = ax * lon + bx and y = ay * mercY(lat) + by,
 * with mercY(lat) = ln(tan(pi/4 + lat/2)), lat in radians. The constants are measured from the real projection.
 */
export function nationalAffine() {
  const merc = (latDeg: number) => Math.log(Math.tan(Math.PI / 4 + (latDeg * Math.PI) / 360));
  const p0 = projection([51, 25])!;
  const p1 = projection([52, 26])!;
  const ax = p1[0] - p0[0];
  const ay = (p1[1] - p0[1]) / (merc(26) - merc(25));
  const bx = p0[0] - ax * 51;
  const by = p0[1] - ay * merc(25);
  return { ax, bx, ay, by };
}

/** Plate units per kilometre at the latitude of the peninsula centre. */
export function nationalUnitsPerKm(): number {
  const lat = 25.35;
  const [x0] = projection([51, lat])!;
  const [x1] = projection([52, lat])!;
  return (x1 - x0) / (111.32 * Math.cos((lat * Math.PI) / 180));
}
