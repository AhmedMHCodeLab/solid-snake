// Plate markup: the live map (one SVG, two plates stacked in depth) and the small static still printed with each step.
// No point markers anywhere except the single verified-site survey mark.
import { GRATICULE_PATH, QATAR_PATH } from '../generated/qatar';
import type { MapShape, MapState } from '../../../shared/types';
import { bbox, CASE_UNITS, centre, pad, pathOf, shapeWorld, union, type Rect, type XY } from './geometry';
import { mapStateAt, shapeById, type Model } from './model';
import { esc, handling } from './util';

export const LAND: Rect = { x: 224, y: 128, w: 354, h: 724 };
export const caseWorld = (m: Model): Rect => ({ x: 0, y: 0, w: m.map.casePlate.widthKm * CASE_UNITS, h: m.map.casePlate.heightKm * CASE_UNITS });

/** The stage camera for a map state: what the plate frames at that step. */
export function stateCamera(m: Model, st: MapState | undefined): Rect {
  if (!st || st.plate === 'national') return pad(LAND, 0.05);
  const rects: Rect[] = [];
  const a = shapeById(m, st.area?.shapeId);
  if (a) rects.push(bbox(shapeWorld(a)));
  for (const s of st.shapes) {
    const sh = shapeById(m, s.shapeId);
    if (sh && s.style !== 'dissolved' && s.style !== 'history' && sh.kind !== 'seal') rects.push(bbox(shapeWorld(sh)));
  }
  if (!rects.length) return caseWorld(m);
  const r = pad(rects.reduce(union), 0.6, 7 * CASE_UNITS);
  return r;
}

/** Where the light falls, in the world units of the state's plate. Light never encodes level. */
export function spotOf(m: Model, st: MapState | undefined): { c: XY; r: number } {
  const sh = shapeById(m, st?.spotlightShapeId);
  if (!sh) {
    const cam = stateCamera(m, st);
    return { c: centre(cam), r: 0 };
  }
  const b = bbox(shapeWorld(sh));
  if (sh.kind === 'verified-site') return { c: centre(b), r: 0.9 * CASE_UNITS };
  return { c: centre(b), r: Math.max(b.w, b.h) * 0.72 + (sh.plate === 'national' ? 18 : 40) };
}

/** Pattern ids are local to each SVG so their spacing can be counter-scaled with the camera. */
function patterns(p: string, scale = 1): string {
  const pat = (id: string, size: number, rot: number, cls: string, cross = false) =>
    `<pattern id="${p}-${id}" class="hatch" data-rot="${rot}" width="${size}" height="${size}" patternUnits="userSpaceOnUse" patternTransform="rotate(${rot}) scale(${scale})"><line class="hs ${cls}" x1="0" y1="0" x2="0" y2="${size}"/>${cross ? `<line class="hs ${cls}" x1="0" y1="0" x2="${size}" y2="0"/>` : ''}</pattern>`;
  return pat('region', 6, 45, 'hs--blue') + pat('sector', 8, 45, 'hs--blue') + pat('obs', 9, 45, 'hs--blue', true) + pat('band', 4, 0, 'hs--blue') + pat('fp', 8, -45, 'hs--graphite');
}

export const areaClass = (s: MapShape | undefined) => (s ? `area area--${s.kind}` : 'area');

function sectorsPath(m: Model): string {
  const r = (deg: number) => (deg * Math.PI) / 180;
  return m.map.casePlate.sectors
    .map((s) => {
      const ax = s.apex[0] * CASE_UNITS, ay = s.apex[1] * CASE_UNITS, rr = s.rangeKm * CASE_UNITS;
      const p = (az: number) => [ax + rr * Math.sin(r(az)), ay - rr * Math.cos(r(az))].map((n) => n.toFixed(1)).join(' ');
      return `M${ax} ${ay}L${p(s.azimuthDeg - s.beamwidthDeg / 2)}A${rr} ${rr} 0 0 1 ${p(s.azimuthDeg + s.beamwidthDeg / 2)}Z`;
    })
    .join('');
}
function gridPaths(m: Model): { minor: string; major: string } {
  const W = caseWorld(m);
  let minor = '', major = '';
  for (let x = CASE_UNITS; x < W.w; x += CASE_UNITS) (x % (5 * CASE_UNITS) === 0 ? (major += `M${x} 0V${W.h}`) : (minor += `M${x} 0V${W.h}`));
  for (let y = CASE_UNITS; y < W.h; y += CASE_UNITS) (y % (5 * CASE_UNITS) === 0 ? (major += `M0 ${y}H${W.w}`) : (minor += `M0 ${y}H${W.w}`));
  return { minor, major };
}

/** The one verified-site mark, drawn at a fixed screen size by the caller's scale. */
export const siteMark = (x: number, y: number, s = 1) =>
  `<g class="site" data-shape="site" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s})"><circle class="site__ring" r="11"/><path class="site__cross" d="M-19 0H19M0 -19V19"/><circle class="site__dot" r="3.6"/></g>`;

const shapeD = (s: MapShape) => pathOf(shapeWorld(s));

// ---- static still --------------------------------------------------------------------------------------------------

/** A small static still of the map at one step: for readers without scripts and as the printed record of the step. */
export function stillSVG(m: Model, step: number, idp: string): string {
  const st = mapStateAt(m, step);
  if (!m.map.region || !st) return '';
  const cam = stateCamera(m, st);
  const unit = cam.w / 420; // world units per CSS pixel at the still's design width
  const spot = spotOf(m, st);
  const area = shapeById(m, st.area?.shapeId);
  const vb = `${cam.x.toFixed(1)} ${cam.y.toFixed(1)} ${cam.w.toFixed(1)} ${cam.h.toFixed(1)}`;
  const veil = `<mask id="${idp}-m" maskUnits="userSpaceOnUse" x="${cam.x}" y="${cam.y}" width="${cam.w}" height="${cam.h}"><rect x="${cam.x}" y="${cam.y}" width="${cam.w}" height="${cam.h}" fill="#fff"/>${spot.r > 0 ? `<circle cx="${spot.c[0].toFixed(1)}" cy="${spot.c[1].toFixed(1)}" r="${(spot.r * 1.22).toFixed(1)}" fill="#808080"/><circle cx="${spot.c[0].toFixed(1)}" cy="${spot.c[1].toFixed(1)}" r="${spot.r.toFixed(1)}" fill="#000"/>` : ''}</mask>`;
  let body = '';
  if (st.plate === 'national') {
    body =
      `<path class="plate__graticule--wall" d="${GRATICULE_PATH}"/><path class="plate__shadow" d="${QATAR_PATH}" transform="translate(${(4 * unit).toFixed(1)} ${(6 * unit).toFixed(1)})"/><path class="plate__land" d="${QATAR_PATH}"/>` +
      `<g clip-path="url(#${idp}-c)"><path class="plate__graticule" d="${GRATICULE_PATH}"/></g>` +
      (area ? `<g class="${areaClass(area)} is-lit"><path class="area__base" d="${shapeD(area)}"/><path class="area__fill" fill="url(#${idp}-region)" d="${shapeD(area)}"/><path class="area__edge" d="${shapeD(area)}"/></g>` : '') +
      `<g clip-path="url(#${idp}-c)"><rect class="plate__veil" x="${cam.x}" y="${cam.y}" width="${cam.w}" height="${cam.h}" mask="url(#${idp}-m)"/></g>`;
  } else {
    const W = caseWorld(m);
    const g = gridPaths(m);
    const shapes = st.shapes
      .map((s) => {
        const sh = shapeById(m, s.shapeId);
        if (!sh || s.style === 'dissolved') return '';
        if (sh.kind === 'verified-site') { const c = centre(bbox(shapeWorld(sh))); return siteMark(c[0], c[1], unit); }
        if (s.style === 'history') return `<path class="history" d="${shapeD(sh)}"/>`;
        if (sh.kind === 'seal') return `<g class="seal"><path class="seal__edge" d="${shapeD(sh)}"/></g>`;
        if (sh.kind === 'footprint') return `<g class="footprint footprint--${s.style}"><path class="footprint__fill" fill="url(#${idp}-fp)" d="${shapeD(sh)}"/><path class="footprint__edge" d="${shapeD(sh)}"/></g>`;
        return '';
      })
      .join('');
    const pat = area?.kind === 'observation-area' ? 'obs' : area?.kind === 'band' ? 'band' : 'sector';
    body =
      `<rect class="plate__shadow" x="${(4 * unit).toFixed(1)}" y="${(6 * unit).toFixed(1)}" width="${W.w}" height="${W.h}"/><rect class="plate__sheet" width="${W.w}" height="${W.h}"/>` +
      `<path class="plate__grid--minor" d="${g.minor}"/><path class="plate__grid--major" d="${g.major}"/><path class="plate__sectors" d="${sectorsPath(m)}"/>` +
      (area ? `<g class="${areaClass(area)}"><path class="area__base" d="${shapeD(area)}"/><path class="area__fill" fill="url(#${idp}-${pat})" d="${shapeD(area)}"/><path class="area__edge" d="${shapeD(area)}"/></g>` : '') +
      shapes +
      `<g clip-path="url(#${idp}-s)"><rect class="plate__veil" width="${W.w}" height="${W.h}" mask="url(#${idp}-m)"/></g>`;
  }
  return `<svg class="still__svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false"><defs>${patterns(idp, unit)}<clipPath id="${idp}-c"><path d="${QATAR_PATH}"/></clipPath><clipPath id="${idp}-s"><rect width="${caseWorld(m).w}" height="${caseWorld(m).h}"/></clipPath>${veil}</defs>${body}</svg>`;
}

// ---- live map ------------------------------------------------------------------------------------------------------

const veilMask = (id: string) => `<mask id="${id}" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="12000" height="12000"><rect x="-5000" y="-5000" width="12000" height="12000" fill="#fff"/><circle class="spot__penumbra" fill="#808080" r="0"/><circle class="spot__pool" fill="#000" r="0"/></mask>`;

/** The persistent map shell: national plate with every region (hidden until counted or lit), and an empty case layer. */
export function mapShellSVG(regions: MapShape[]): string {
  return `<svg class="cmap__svg" role="presentation" focusable="false" aria-hidden="true">
<defs>${patterns('mn')}${patterns('mc')}<clipPath id="mclip-land"><path d="${QATAR_PATH}"/></clipPath>${veilMask('mveil-n')}${veilMask('mveil-c')}<g id="mclip-holder"></g></defs>
<g class="cmap__nat" data-layer="national">
  <path class="plate__graticule--wall" d="${GRATICULE_PATH}"/>
  <path class="plate__shadow" d="${QATAR_PATH}" data-shadow/>
  <path class="plate__land" d="${QATAR_PATH}"/>
  <g clip-path="url(#mclip-land)"><path class="plate__graticule" d="${GRATICULE_PATH}"/></g>
  ${regions.map((r) => `<g class="${areaClass(r)}" data-shape="${esc(r.id)}" data-select="${esc(r.id)}" hidden><path class="area__base" d="${shapeD(r)}"/><path class="area__fill" fill="url(#mn-region)" d="${shapeD(r)}"/><path class="area__edge" d="${shapeD(r)}"/></g>`).join('')}
  <g clip-path="url(#mclip-land)"><rect class="plate__veil" x="-200" y="-200" width="1200" height="1400" mask="url(#mveil-n)"/></g>
</g>
<rect class="cmap__recede" x="0" y="0" width="10" height="10" opacity="0"/>
<g class="cmap__case" data-layer="case" visibility="hidden"></g>
</svg>`;
}

/** The case plate's contents for one case, in world units. Inserted into .cmap__case. */
export function caseLayer(m: Model): string {
  const W = caseWorld(m);
  const g = gridPaths(m);
  const fps = m.map.shapes.filter((s) => s.kind === 'footprint');
  const hist = m.map.shapes.filter((s) => s.kind !== 'region' && s.kind !== 'footprint' && s.kind !== 'verified-site' && s.kind !== 'seal');
  const site = m.map.shapes.find((s) => s.kind === 'verified-site');
  const seal = m.map.shapes.find((s) => s.kind === 'seal');
  const sc = site ? centre(bbox(shapeWorld(site))) : null;
  return `<clipPath id="mclip-sheet"><rect width="${W.w}" height="${W.h}"/></clipPath>
  <rect class="plate__shadow" width="${W.w}" height="${W.h}" data-shadow/>
  <rect class="plate__sheet" width="${W.w}" height="${W.h}"/>
  <path class="plate__grid--minor" d="${g.minor}"/><path class="plate__grid--major" d="${g.major}"/>
  <path class="plate__sectors" d="${sectorsPath(m)}"/>
  ${hist.map((s) => `<path class="history" data-shape="${esc(s.id)}" d="${shapeD(s)}" hidden/>`).join('')}
  <g class="area" data-shape="area" data-select=""><path class="area__base"/><path class="area__fill"/><path class="area__edge"/></g>
  ${fps.map((s) => `<g class="footprint" data-shape="${esc(s.id)}" data-select="${esc(s.id)}" hidden><path class="footprint__fill" fill="url(#mc-fp)" d="${shapeD(s)}"/><path class="footprint__edge" d="${shapeD(s)}"/><path class="footprint__ink" d="${shapeD(s)}"/></g>`).join('')}
  ${seal ? `<g class="seal" data-shape="${esc(seal.id)}" hidden><path class="seal__edge" d="${shapeD(seal)}"/></g>` : ''}
  ${sc && site ? siteMark(sc[0], sc[1]).replace('data-shape="site"', `data-shape="${esc(site.id)}" data-select="${esc(site.id)}" hidden`) : ''}
  <g clip-path="url(#mclip-sheet)"><rect class="plate__veil" width="${W.w}" height="${W.h}" mask="url(#mveil-c)"/></g>`;
}

export { handling };
