// Map shapes for cases A to C. National plate: one broad region on [longitude, latitude]. Case plate: a simulated
// local grid in km. Every area shape is resampled to AREA_POINTS points (see geometry.ts).
import type { MapModel, MapShape, Point } from '../../shared/types';
import { Rng, r, subSeed } from './prng';
import { bandPoly, blobPoly, fanPoly, geoAreaKm2, geoBlob, polar, polyArea, resample, sectorPoly } from './geometry';
import type { Gen } from './records';
import { cellName } from './ident';

export const DISCLAIMER = 'Positions on this plate are simulated and do not correspond to real places.';
export const PLATE_KM = 12;
const STEP_KM = 0.078;

export interface FootprintSpec {
  hypId: string;
  /** Bearing and distance from the lead antenna to the footprint centre, and its radii. */
  az: number;
  dist: number;
  rx: number;
  ry: number;
  label: string;
  derivation: string;
}

export interface PlateSpec {
  L: string;
  whereId: string;
  region: { lon: number; lat: number };
  fps: FootprintSpec[];
  band?: { stepsFrom: number; stepsTo: number; margin: number };
  sealBoundTo?: string;
}

export interface PlateBuild {
  region: NonNullable<MapModel['region']>;
  casePlate: MapModel['casePlate'];
  shapes: MapShape[];
  areas: Record<string, number>;
  ids: { region: string; sec1: string; sec2: string; obs: string; band: string | null; fps: Record<string, string>; site: string | null; seal: string | null };
  /** Number of group records on the lead sector, the second sector, and in total with a cell. */
  nLead: number;
  nSecond: number;
  bandKm?: { r1: number; r2: number };
}

export function buildPlate(gen: Gen, seed: number, spec: PlateSpec): PlateBuild {
  const { L } = spec;
  const layout = gen.layout;
  if (!layout) throw new Error('plate needs a layout');
  const rng = new Rng(subSeed(seed, `plate-${L}`));
  const lead = layout.lead;
  const second = layout.second;
  const shapes: MapShape[] = [];
  const areas: Record<string, number> = {};
  const caseArea = (pts: Point[]): number => r(polyArea(pts), 3);

  // National plate: the region, tens of kilometres across, inland or northern, not centred on the capital.
  const regionPts = resample(geoBlob(spec.region.lon, spec.region.lat, 15, 13, rng), 4);
  // An opaque id: the region is served in the alert queue, before a case exists, so it must not name a scenario.
  const regionId = `RGN-${subSeed(seed, `region-${L}`).toString(16).padStart(8, '0')}`;
  shapes.push({
    id: regionId,
    kind: 'region',
    plate: 'national',
    points: regionPts,
    boundTo: spec.whereId,
    label: 'Region R: a broad area about 30 km across. The case inside it is simulated.',
    derivation: 'The cell values carried by the records of group G fall inside this region. It is drawn no finer than tens of kilometres and is not a position.',
    basis: 'FICTION',
  });
  areas[regionId] = r(geoAreaKm2(regionPts), 3);

  const cellCount = (ref: string): number => gen.gOrig.filter((x) => (x.userLocationInfo?.cellRef ?? x.accessNetworkInformation?.cellRef) === ref).length;
  const nLead = cellCount(lead.cellRef);
  const nSecond = cellCount(second.cellRef);

  const sec1 = `SH-${L}-sector-1`;
  const sec2 = `SH-${L}-sector-2`;
  const sectorShape = (id: string, s: typeof lead, n: number): MapShape => {
    const pts = resample(sectorPoly(s.apex, s.azimuthDeg, s.beamwidthDeg, s.rangeKm), 3);
    areas[id] = caseArea(pts);
    return {
      id,
      kind: 'sector',
      plate: 'case',
      points: pts,
      boundTo: spec.whereId,
      label: `Cell area, ${cellName(s.cellRef)}: simulated site; the shape and reach are ASSUMPTION. A cell area is not a position.`,
      derivation: `${n} answered outgoing call records of group G name this cell area (cell identity ${s.ecgi}). Azimuth ${s.azimuthDeg} degrees, beamwidth ${s.beamwidthDeg} degrees, range ${s.rangeKm} km: ASSUMPTION.`,
      supplier: 'network-provided',
      basis: 'ASSUMPTION',
    };
  };
  shapes.push(sectorShape(sec1, lead, nLead), sectorShape(sec2, second, nSecond));

  const obsId = `SH-${L}-obs`;
  const obsPts = resample(fanPoly(lead.apex, lead.azimuthDeg - lead.beamwidthDeg / 2, second.azimuthDeg + second.beamwidthDeg / 2, lead.rangeKm), 3);
  areas[obsId] = caseArea(obsPts);
  shapes.push({
    id: obsId,
    kind: 'observation-area',
    plate: 'case',
    points: obsPts,
    boundTo: spec.whereId,
    label: `Observation area: union of ${cellName(lead.cellRef)} and ${cellName(second.cellRef)}, one simulated site.`,
    derivation: `Union of the cell areas in which records of group G appeared (${nLead + nSecond} records with a cell). The shapes are ASSUMPTION.`,
    supplier: 'network-provided',
    basis: 'ASSUMPTION',
  });

  let bandId: string | null = null;
  let bandKm: { r1: number; r2: number } | undefined;
  if (spec.band) {
    bandId = `SH-${L}-band`;
    const r1 = r((spec.band.stepsFrom - spec.band.margin) * STEP_KM, 3);
    const r2 = r((spec.band.stepsTo + spec.band.margin) * STEP_KM, 3);
    bandKm = { r1, r2 };
    const pts = resample(bandPoly(lead.apex, lead.azimuthDeg, lead.beamwidthDeg, r1, r2), 3);
    areas[bandId] = caseArea(pts);
    shapes.push({
      id: bandId,
      kind: 'band',
      plate: 'case',
      points: pts,
      boundTo: spec.whereId,
      label: `Band inside ${cellName(lead.cellRef)}: radio distance steps ${spec.band.stepsFrom} to ${spec.band.stepsTo} plus an error margin of ${spec.band.margin} steps. ASSUMPTION: modelled source.`,
      derivation: `Distance from the antenna: one LTE timing-advance step is about 78 m, so ${r1} to ${r2} km including the error margin. It is an area inside one cell area, not a position.`,
      basis: 'ASSUMPTION',
    });
  }

  const fps: Record<string, string> = {};
  let siteCentre: Point | null = null;
  for (const f of spec.fps) {
    const id = `SH-${L}-fp-${f.hypId}`;
    const c = polar(lead.apex, f.az, f.dist);
    const pts = resample(blobPoly(c[0], c[1], f.rx, f.ry, rng, 0.1), 3);
    for (const p of pts) if (p[0] < 0.2 || p[0] > PLATE_KM - 0.2 || p[1] < 0.2 || p[1] > PLATE_KM - 0.2) throw new Error(`footprint ${id} leaves the plate`);
    areas[id] = caseArea(pts);
    shapes.push({ id, kind: 'footprint', plate: 'case', points: pts, boundTo: f.hypId, label: f.label, derivation: f.derivation, basis: 'ASSUMPTION' });
    fps[f.hypId] = id;
    if (siteCentre === null) siteCentre = [r(c[0], 3), r(c[1], 3)];
  }

  let siteId: string | null = null;
  let sealId: string | null = null;
  if (spec.sealBoundTo && siteCentre && bandId) {
    siteId = `SH-${L}-site`;
    shapes.push({
      id: siteId,
      kind: 'verified-site',
      plate: 'case',
      points: [siteCentre],
      boundTo: spec.sealBoundTo,
      label: 'Verified (simulated): surveyed site on the simulated case plate.',
      derivation: 'Result of the field survey and controlled test call (E6), simulated ground truth. The only mark on any plate.',
      basis: 'FICTION',
    });
    sealId = `SH-${L}-seal`;
    const band = shapes.find((s) => s.id === bandId) as MapShape;
    shapes.push({
      id: sealId,
      kind: 'seal',
      plate: 'case',
      points: band.points.map((p): Point => [p[0], p[1]]),
      boundTo: spec.sealBoundTo,
      label: 'Seal: the area under sign-off, simulated.',
      derivation: 'Reuses the final area polygon at the step where the entry reached level 5.',
      basis: 'FICTION',
    });
    areas[sealId] = areas[bandId] as number;
  }

  return {
    region: { shapeId: regionId, label: 'Region R, a broad area about 30 km across (simulated case)' },
    casePlate: {
      widthKm: PLATE_KM,
      heightKm: PLATE_KM,
      disclaimer: DISCLAIMER,
      sectors: layout.sectors.map((s) => ({ cellRef: s.cellRef, apex: s.apex, azimuthDeg: s.azimuthDeg, beamwidthDeg: s.beamwidthDeg, rangeKm: s.rangeKm, basis: s.basis })),
    },
    shapes,
    areas,
    ids: { region: regionId, sec1, sec2, obs: obsId, band: bandId, fps, site: siteId, seal: sealId },
    nLead,
    nSecond,
    ...(bandKm ? { bandKm } : {}),
  };
}
