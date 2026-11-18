// Case A: unusual outgoing call volume on one cell area. Reaches level 5 (simulated).
import type { CaseFile, EvidenceItem, Expectation, Indicator, Rule } from '../../shared/types';
import { assemble, cl, ctx, lim } from './builder';
import type { ClaimDef, HypDef, MapStateDef, StepDef } from './builder';
import { ids, indicator, mean1, reasonCodes, winOf, SUPERVISOR_CHECKS } from './common';
import { RECIPIENTS, FIELD_SPECS, SOURCES, independence } from './sources';
import { RULE_DEFS, RULE_FN } from './rules';
import { W } from './wording';
import { buildPlate } from './maps';
import { r } from './prng';
import type { Gen } from './records';
import { IN_ROUTES, cellName, tacOf } from './ident';
import { groupCharts } from './charts';
import { ENTITIES, META } from './meta';

const NDSS = 'Oh et al., NDSS 2023, Preventing SIM Box Fraud Using Device Model Fingerprinting (RESEARCH)';
const BICS = 'BICS Telco Fraud Whitepaper (vendor source, PRACTICE)';
const WIN = '72-hour window';
const ORD = 'ordinary SIMs on these cells and their neighbours (stated aggregate, simulated)';

export function buildA(seed: number, g: Gen): CaseFile {
  const L = 'A';
  const lay = g.layout!;
  const lead = lay.lead.cellRef;
  const second = lay.second.cellRef;
  const nG = g.gOrig.length;
  const nDist = new Set(g.gOrig.map((x) => x.calledPartyAddress)).size;
  const simsG = g.groupUris.length;
  const route = (n: number) => g.routes[(IN_ROUTES[n - 1] as { ref: string }).ref] ?? [];
  const rn = (n: number) => (IN_ROUTES[n - 1] as { plain: string }).plain;
  const rb = (n: number) => g.routeBaselines[(IN_ROUTES[n - 1] as { ref: string }).ref] as number;

  const plate = buildPlate(g, seed, {
    L,
    whereId: 'A-2',
    region: { lon: 51.15, lat: 25.45 },
    band: { stepsFrom: 23, stepsTo: 27, margin: 2 },
    sealBoundTo: 'H-A1',
    fps: [
      { hypId: 'H-A1', az: 98, dist: 1.95, rx: 0.22, ry: 0.2, label: 'Footprint predicted by H-A1: one installation inside the band.', derivation: 'What SIM-box operation predicts about where activity would be seen: a single installation, so a compact area. Basis ASSUMPTION.' },
      { hypId: 'H-A2', az: 72, dist: 1.15, rx: 0.5, ry: 0.32, label: 'Footprint predicted by H-A2: a group of office premises nearer the antenna.', derivation: 'What a call centre using cellular gateways predicts: an office area, not necessarily at the band distance. Basis ASSUMPTION.' },
      { hypId: 'H-A3', az: 112, dist: 1.5, rx: 1.2, ry: 0.75, label: 'Footprint predicted by H-A3: devices spread across the observation area.', derivation: 'What a registered group of connected devices predicts: dispersed equipment, so a wide area. Basis ASSUMPTION.' },
    ],
  });
  const P = plate.ids;
  const band = plate.bandKm!;

  // ---- Indicators -----------------------------------------------------------------------------
  const B1 = mean1(g.bgOrig, 'R-1');
  const B3 = mean1(g.bgOrig, 'R-3');
  const B4 = r(RULE_FN['R-4']!(g.bgAll, { baseline: 1 }), 2);
  const routeInd = (id: string, n: number, bid: string): Indicator =>
    indicator({ L, id, ruleId: 'R-2', source: 'E2', description: `International calls received on ${rn(n)}, against the route's own usual count`, unit: 'ratio of the usual count', recs: route(n), baseline: { id: bid, description: `Calls received on ${rn(n)} in a 72-hour window`, value: rb(n), population: "the route's own earlier 72-hour windows (stated aggregate, simulated)" } });
  const indicators: Indicator[] = [
    indicator({ L, id: 'I-1', ruleId: 'R-1', source: 'E1', description: 'Mean answered calls per SIM, group G', unit: 'calls per SIM', recs: g.gOrig, baseline: { id: 'B1', description: 'Mean answered calls per SIM in a 72-hour window', value: B1, population: ORD } }),
    routeInd('I-2', 3, 'B2'),
    indicator({ L, id: 'I-3', ruleId: 'R-3', source: 'E1', description: 'Mean number of different cell areas per SIM, group G', unit: 'cell areas per SIM', recs: g.gOrig, baseline: { id: 'B3', description: 'Mean number of different cell areas per SIM in a 72-hour window', value: B3, population: ORD } }),
    indicator({ L, id: 'I-4', ruleId: 'R-4', source: 'E1', description: 'Incoming call records per outgoing call record, group G', unit: 'ratio', recs: [...g.gOrig, ...g.gTerm], baseline: { id: 'B4', description: 'Incoming call records per outgoing call record', value: B4, population: ORD } }),
    routeInd('I-5', 1, 'B5'),
    routeInd('I-6', 2, 'B6'),
  ];
  const I = (id: string): Indicator => indicators.find((x) => x.id === id) as Indicator;
  const windowText = `${WIN} from 2031-03-04`;
  const pop = (b: number) => `ordinary SIMs on these cells, baseline ${b}`;

  // ---- Evidence items -------------------------------------------------------------------------
  const model = tacOf(g.devices[0] as string);
  const evidenceItems: EvidenceItem[] = [
    {
      simulated: true,
      id: 'EVI-A-E3',
      source: 'E3',
      title: 'Device information for group G',
      summary: `Network signalling shows the ${simsG} SIMs of group G connected from ${g.devices.length} different devices of one device model.`,
      fields: { simsObserved: simsG, distinctDevices: g.devices.length, deviceModelCode: model, method: 'attach and capability messages, not call records' },
      basis: 'ASSUMPTION',
      basisNote: `Method after ${NDSS}; that the operator collects it is ASSUMPTION. Device identities are built in the GSMA test range (TS.06 reporting body 00), in a block no allocating body issues.`,
    },
    {
      simulated: true,
      id: 'EVI-A-E5',
      source: 'E5',
      title: `Radio distance measurement on ${cellName(lead)}`,
      summary: `The radio distance measurement for calls of group G in ${cellName(lead)} reports 23 to 27 steps from the antenna, about ${band.r1} to ${band.r2} km once the error margin of 2 steps is included.`,
      fields: { cellArea: cellName(lead), timingAdvanceStepsFrom: 23, timingAdvanceStepsTo: 27, stepLengthKm: 0.078, errorMarginSteps: 2, distanceFromKm: band.r1, distanceToKm: band.r2 },
      basis: 'ASSUMPTION',
      basisNote: 'ASSUMPTION: whether timing advance is recorded is a choice of this platform (PRODUCT.md U12). One LTE step is about 78 m, INFERRED arithmetic from ETSI TS 136 213 clause 4.2.3 (DECISIONS.md section 5).',
    },
    {
      simulated: true,
      id: 'EVI-A-E6',
      source: 'E6',
      title: 'Field survey and test call (simulated)',
      summary: `A field survey of the band inside ${cellName(lead)} found one installed device holding ${simsG} SIM slots in use by the SIMs of group G. A controlled test call presented a local caller number.`,
      fields: { siteRef: 'Survey site A1', device: `one installation, ${simsG} SIM slots`, testCall: 'local caller number presented', surveyedArea: `band inside ${cellName(lead)}` },
      basis: 'FICTION',
      basisNote: 'FICTION: prepared ground truth served by a demo connector, labelled simulated (PRODUCT.md 2.4 level 5). Nothing here concerns a real place.',
    },
  ];

  // ---- Claims ---------------------------------------------------------------------------------
  const cellCount = plate.nLead + plate.nSecond;
  const claims: ClaimDef[] = [
    {
      kind: 'evidence',
      id: 'A-1',
      subject: 'Voice activity of SIM group G',
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `the ${simsG} SIMs of group G placed ${nG} answered calls in 72 hours, to ${nDist} different numbers`), evidenceIds: ids(g.gOrig), sources: ['E1'], added: `${nG} outgoing call records of group G entered` },
        { step: 1, level: 2, statement: W.l2('I-1', `mean answered calls per SIM in group G (${I('I-1').value})`, I('I-1').position, 'B1', pop(B1), windowText), evidenceIds: ['I-1'], ruleId: 'R-1', sources: ['E1'], added: 'indicator I-1 against baseline B1 added' },
        { step: 4, level: 3, statement: W.l3('call records (E1)', 'international gateway records (E2)', `outgoing calls of group G above baseline B1 while international calls received on ${rn(3)} are below that route's own baseline (${I('I-2').value} of its usual count)`), evidenceIds: ['I-1', 'I-2'], ruleId: 'R-2', sources: ['E1', 'E2'], independenceId: 'IND-A-1', added: 'international gateway indicator I-2 added' },
      ],
    },
    {
      kind: 'evidence',
      id: 'A-2',
      subject: 'Where group G was observed (cell areas)',
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `${cellCount} of the ${nG} records of group G name a cell area, and all of them fall inside region R: ${plate.nLead} in ${cellName(lead)} and ${plate.nSecond} in ${cellName(second)}`), evidenceIds: ids(g.gOrig), sources: ['E1'], added: 'cell areas of group G fall inside region R' },
        { step: 3, level: 2, statement: W.l2('I-3', `mean number of different cell areas per SIM in group G (${I('I-3').value})`, I('I-3').position, 'B3', pop(B3), windowText), evidenceIds: ['I-3'], ruleId: 'R-3', sources: ['E1'], added: 'indicator I-3 and the observation area added' },
        { step: 6, level: 3, statement: W.l3('call records (E1)', 'the radio distance measurement (E5)', `activity of group G inside a band of ${plate.areas[P.band!]} km2 within ${cellName(lead)}, about ${band.r1} to ${band.r2} km from the antenna`), evidenceIds: ['I-3', 'EVI-A-E5'], ruleId: 'R-3', sources: ['E1', 'E5'], independenceId: 'IND-A-2', added: 'radio distance measurement E5 added' },
      ],
    },
    {
      kind: 'evidence',
      id: 'A-3',
      subject: 'Devices used by group G',
      versions: [{ step: 5, level: 1, statement: W.l1('device information (E3)', `the ${simsG} SIMs of group G connected from ${g.devices.length} different devices of one device model`), evidenceIds: ['EVI-A-E3'], sources: ['E3'], added: 'device information E3 added' }],
    },
  ];

  // ---- Hypotheses -----------------------------------------------------------------------------
  const alt = (...n: string[]) => n;
  const sameTests = [
    { description: `SIM registration records for the ${simsG} SIMs`, needs: 'SIM registration records (E4)', status: 'not-returned' as const },
    { description: 'Field survey of the band and a controlled test call', needs: 'Field survey and test call (E6)', status: 'returned' as const },
  ];
  const evid = ['I-1', 'I-2', 'I-3', 'EVI-A-E3', 'EVI-A-E5'];
  const hyps: HypDef[] = [
    {
      kind: 'hypothesis',
      id: 'H-A1',
      name: 'SIM-box operation',
      cites: ['A-1', 'A-2', 'A-3'],
      rivals: ['H-A2', 'H-A3'],
      innocent: false,
      support: 'An international shortfall that persists, no registered business use of the SIMs, and a survey of the band that finds equipment or a test call that shows a local caller number.',
      refute: 'Registration records showing business use of the SIMs, or a survey that finds a different installation.',
      tests: sameTests,
      footprintShapeId: P.fps['H-A1']!,
      versions: [
        { step: 7, state: 'open', level: 4, statement: W.l4('H-A1', 'SIM-box operation', alt('call centre using cellular gateways', 'registered group of connected devices'), 'supported by an international shortfall that persists and a survey of the band that finds equipment; refuted by registration records showing business use of the SIMs.'), evidenceIds: evid, added: 'cites A-1, A-2 and A-3' },
        { step: 9, state: 'verified', level: 5, statement: W.l5(`a field survey of the band inside ${cellName(lead)} found one installed SIM box in use by the ${simsG} SIMs of group G, and a controlled test call presented a local caller number`), evidenceIds: ['EVI-A-E6'], added: 'field survey and test call E6, from outside the analysis' },
      ],
    },
    {
      kind: 'hypothesis',
      id: 'H-A2',
      name: 'call centre using cellular gateways',
      cites: ['A-1', 'A-2', 'A-3'],
      rivals: ['H-A1', 'H-A3'],
      innocent: true,
      support: 'Registration records showing a business customer, or a survey that finds office premises with gateways in use.',
      refute: 'A survey that finds no office installation, or a test call that shows a local caller number.',
      tests: sameTests,
      footprintShapeId: P.fps['H-A2']!,
      versions: [
        { step: 7, state: 'open', level: 4, statement: W.l4('H-A2', 'call centre using cellular gateways', alt('SIM-box operation', 'registered group of connected devices'), 'supported by office premises with gateways in use; refuted by a survey that finds no office installation.'), evidenceIds: evid, added: 'cites A-1, A-2 and A-3' },
        { step: 9, state: 'fallen', level: null, statement: W.fell('H-A2', 'call centre using cellular gateways', 'the field survey (E6) found no office installation, and the test call presented a local caller number'), evidenceIds: ['EVI-A-E6'], added: 'field survey E6 found no office installation' },
      ],
    },
    {
      kind: 'hypothesis',
      id: 'H-A3',
      name: 'registered group of connected devices',
      cites: ['A-1', 'A-2', 'A-3'],
      rivals: ['H-A1', 'H-A2'],
      innocent: true,
      support: 'Registration records showing a contract for connected devices that covers the SIMs, or devices of one model spread across the observation area.',
      refute: 'No such contract, or a survey that finds equipment concentrated at one site.',
      tests: sameTests,
      footprintShapeId: P.fps['H-A3']!,
      versions: [
        { step: 7, state: 'open', level: 4, statement: W.l4('H-A3', 'registered group of connected devices', alt('SIM-box operation', 'call centre using cellular gateways'), 'supported by a contract for connected devices that covers the SIMs; refuted by equipment concentrated at one site.'), evidenceIds: evid, added: 'cites A-1, A-2 and A-3' },
        { step: 9, state: 'fallen', level: null, statement: W.fell('H-A3', 'registered group of connected devices', 'the field survey (E6) found the equipment at one site, not spread across the observation area'), evidenceIds: ['EVI-A-E6'], added: 'field survey E6 found equipment at one site' },
      ],
    },
  ];

  // ---- Expectations ---------------------------------------------------------------------------
  const window = winOf(L);
  const r3 = route(3).length;
  const base3 = rb(3);
  const expectations: Expectation[] = [
    { id: 'EXP-A-1', what: `International calls received on ${rn(3)} up to the route's own usual level of ${base3} per 72 hours: ${base3 - r3} of them are not observed (${r3} observed).`, fromSource: 'E2', ruleId: 'R-2', window, timeline: [{ step: 4, state: 'not-observed' }], limits: ['A-1', 'H-A1'] },
    { id: 'EXP-A-2', what: `Incoming calls to the ${simsG} SIMs of group G at the ratio ordinary SIMs show (${B4} incoming per outgoing record): ${g.gTerm.length} observed against ${nG} outgoing.`, fromSource: 'E1', ruleId: 'R-4', window, timeline: [{ step: 5, state: 'not-observed' }], limits: ['A-1', 'H-A1'] },
    { id: 'EXP-A-3', what: `SIM registration records (E4) for the ${simsG} SIMs of group G, requested at stage 4: not returned.`, fromSource: 'E4', ruleId: 'R-7', window, timeline: [{ step: 8, state: 'not-observed' }], limits: ['H-A1', 'H-A2', 'H-A3'] },
    { id: 'EXP-A-4', what: 'Result of a field survey and controlled test call (E6), requested at stage 4.', fromSource: 'E6', ruleId: 'R-8', window, timeline: [{ step: 8, state: 'not-observed' }, { step: 9, state: 'observed' }], limits: ['H-A1', 'H-A2', 'H-A3'] },
  ];

  // ---- Map states -----------------------------------------------------------------------------
  const nat: MapStateDef = { plate: 'national', area: P.region, shapes: [], spot: P.region, note: 'Region R is lit. The cell values in the records of group G fall inside it. Examined after the fact. SIMULATED.' };
  const s2: MapStateDef = { plate: 'case', area: P.sec1, shapes: [], spot: P.sec1, note: `First cell area: ${cellName(lead)}. A cell area is not a position. SIMULATED.` };
  const s3: MapStateDef = { plate: 'case', area: P.obs, shapes: [[P.sec1, 'history']], spot: P.obs, note: 'Observation area: the union of 2 cell areas of one simulated site. SIMULATED.' };
  const s6: MapStateDef = { plate: 'case', area: P.band!, shapes: [[P.obs, 'history'], [P.sec1, 'history']], spot: P.band!, note: `Band inside ${cellName(lead)} from the radio distance measurement (E5). An area, not a position. SIMULATED.` };
  const fps = (a: 'dashed' | 'solid', b: 'dashed' | 'dissolved'): [string, 'dashed' | 'solid' | 'dissolved'][] => [[P.fps['H-A1']!, a], [P.fps['H-A2']!, b], [P.fps['H-A3']!, b]];
  const s7: MapStateDef = { plate: 'case', area: P.band!, shapes: [[P.obs, 'history'], ...fps('dashed', 'dashed')], spot: null, note: 'Three explanations drawn as dashed footprints: what each predicts, basis ASSUMPTION. SIMULATED.' };
  const s9: MapStateDef = { plate: 'case', area: P.band!, shapes: [[P.obs, 'history'], ...fps('solid', 'dissolved'), [P.site!, 'solid']], spot: P.site!, note: 'Verified (simulated): the survey mark sits inside the H-A1 footprint. The other two footprints dissolved. SIMULATED.' };
  const s10: MapStateDef = { plate: 'case', area: P.band!, shapes: [...s9.shapes, [P.seal!, 'solid']], spot: P.seal!, note: 'Seal bound to H-A1 on the final area, simulated.' };
  const states: MapStateDef[] = [nat, { ...nat, note: 'The window of 72 hours is shown beside the region. SIMULATED.' }, s2, s3, { ...s3, spot: null }, { ...s3, spot: null }, s6, s7, s7, s9, s10, { ...s10, spot: null }, { ...s10, spot: null }];

  // ---- Charts ---------------------------------------------------------------------------------
  const charts = groupCharts(g, { L: 'A', entryId: 'A-1', linksEntryId: 'A-3', group: 'group G', withRoutes: true, routeNote: `Calls received on each route in the window, beside that route's own usual level. ${rn(3)} is below its usual level; the other two are within it. A shortfall does not say what replaced the traffic.` }, IN_ROUTES.map((_, i) => rb(i + 1)));

  // ---- Steps ----------------------------------------------------------------------------------
  const firstG = g.gOrig[0]!.id;
  const withCell = g.gOrig.find((x) => x.userLocationInfo)!.id;
  const steps: StepDef[] = [
    {
      stage: 1,
      title: 'Alert and call records',
      trigger: { kind: 'open' },
      actionLabel: 'Open the case from the alert',
      stageAnnounce: 'Stage 1, Signal: the alert opens the case and the call records of 72 hours enter the examination, after the calls were made.',
      mapAnnounce: 'Region R lit on the national map: the cell values of group G fall inside it.',
      blocks: [
        cl('A-1'),
        cl('A-2'),
        ctx('The platform reads call records after the calls were made. Detection from call records happens after the calls were made, so nothing here prevents or interrupts a call.', 'RESEARCH', `${NDSS}: detection from call records and call quality works only after calls have been made (PRODUCT.md P4).`),
        lim('A record shows that a call was charged. It does not show who placed it or why.'),
      ],
      exhibits: [{ kind: 'records', refId: firstG }],
    },
    {
      stage: 1,
      title: 'Group G against ordinary SIMs',
      trigger: { kind: 'auto' },
      actionLabel: 'Compare group G with ordinary SIMs',
      blocks: [
        cl('A-1'),
        ctx('A call centre, a business SIM pool or a group of connected devices on one cell area can produce the same pattern. They are listed now and stay listed.', 'ASSUMPTION', `ASSUMPTION: PRODUCT.md 2.2 lists these as legitimate lookalikes. ${NDSS} argues IoT fingerprints may overlap with SIM boxes.`),
        lim('The indicator is an ordering against a baseline. It does not say what caused the volume.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-1' }, { kind: 'chart', refId: 'CH-A-1' }, { kind: 'chart', refId: 'CH-A-2' }],
    },
    {
      stage: 2,
      title: 'One cell area',
      trigger: { kind: 'auto' },
      actionLabel: 'Place the calls on the cell map',
      stageAnnounce: 'Stage 2, Evidence: the map moves from the national view to the case view.',
      mapAnnounce: `Now viewing: case view, simulated grid. First cell area: ${cellName(lead)}.`,
      blocks: [
        cl('A-2'),
        ctx(`The map first shows ${cellName(lead)}, the cell area most records name. The cell value in a record names the cell serving the call at answer. Most records carry it from the network; some carry what the device reported.`, 'FACT', 'ETSI TS 132 260 clause 5.1.9 and ETSI TS 124 229 clause 7.2A.4 (DECISIONS.md section 5).'),
        lim('A cell area is not a position. The shape drawn for it is an assumed shape: direction, width and reach are ASSUMPTION.'),
      ],
      exhibits: [{ kind: 'records', refId: withCell }],
    },
    {
      stage: 2,
      title: 'The observation area widens',
      trigger: { kind: 'auto' },
      actionLabel: 'Widen the observation area',
      mapAnnounce: `Observation area widened to the union of ${cellName(lead)} and ${cellName(second)}: indicator I-3 added.`,
      blocks: [
        cl('A-2'),
        ctx(`The observation area is the union of the cell areas in which the records of group G appeared, ${plate.areas[P.obs]} km2 on the simulated grid. The SIMs of group G use fewer cell areas than ordinary SIMs on the same cells.`, 'ASSUMPTION', 'ASSUMPTION: near-static association is a widely repeated indicator that was not verified in discovery (PRODUCT.md 2.2, U7).'),
        lim('The observation area shows where the radio connection occurred. It does not show where any equipment is.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-3' }],
    },
    {
      stage: 2,
      title: 'International calls that did not arrive',
      trigger: { kind: 'collect', source: 'E2' },
      actionLabel: 'Request international gateway records',
      blocks: [
        cl('A-1'),
        ctx('A SIM box places the last leg of an international call from local SIMs, so the international leg is not in those SIMs\' records. What can show is an absence: international calls that would be expected on a route and did not arrive.', 'PRACTICE', `${BICS}. That record visibility works this way is ASSUMPTION (PRODUCT.md P6).`),
        ctx(`Two routes sit within their own baselines. ${rn(3)} is below its own baseline. The gateway records were collected at the network border, apart from the call-handling servers.`, 'FICTION', 'FICTION: prepared case data. The IBCF record model is ETSI TS 132 260 Table 6.1.3.10.1.'),
        lim('The two sources are both charging records and differ only in where they are collected, so this correlation is the weakest form of independence.'),
        lim('A shortfall on one route does not say what replaced the traffic.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-2' }, { kind: 'indicator', refId: 'I-5' }, { kind: 'indicator', refId: 'I-6' }, { kind: 'expectation', refId: 'EXP-A-1' }, { kind: 'chart', refId: 'CH-A-3' }],
    },
    {
      stage: 2,
      title: 'Device information and incoming calls',
      trigger: { kind: 'collect', source: 'E3' },
      actionLabel: 'Request device information',
      blocks: [
        cl('A-3'),
        ctx('Device information comes from network signalling, not from call records. It can narrow the type of device and never settle it: two SIM boxes from different makers share a fingerprint in the lab data, and fingerprints of connected devices may not be unique.', 'RESEARCH', `${NDSS}, lab LTE testbed (PRODUCT.md P2 and P3; DECISIONS.md N-01).`),
        lim(`Incoming call records exist for ordinary SIMs and almost none for group G (${g.gTerm.length} against ${nG} outgoing). That absence limits A-1. It does not by itself separate a SIM box from other outgoing-only uses.`),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-A-E3' }, { kind: 'indicator', refId: 'I-4' }, { kind: 'expectation', refId: 'EXP-A-2' }, { kind: 'chart', refId: 'CH-A-4' }],
    },
    {
      stage: 2,
      title: 'Radio distance measurement narrows the area',
      trigger: { kind: 'collect', source: 'E5' },
      actionLabel: 'Request radio distance measurement',
      mapAnnounce: `Observation area narrowed to a band inside ${cellName(lead)}: radio distance measurement E5 added.`,
      blocks: [
        cl('A-2'),
        ctx('The radio distance measurement is reported in steps of about 78 m from the antenna. The band is several steps wide, plus a stated error margin.', 'ASSUMPTION', 'ASSUMPTION: whether timing advance is recorded is a choice of this platform (PRODUCT.md U12). Step length is INFERRED arithmetic from ETSI TS 136 213 clause 4.2.3 (DECISIONS.md section 5).'),
        lim('The band is a distance range from the antenna inside one cell area. It is still an area, and by analysis the geographic claim stops at level 3.'),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-A-E5' }],
    },
    {
      stage: 3,
      title: 'Three competing explanations',
      trigger: { kind: 'hypotheses' },
      actionLabel: 'Record the competing explanations',
      stageAnnounce: 'Stage 3, Rivals: three explanations are recorded together at level 4.',
      mapAnnounce: 'Three footprints drawn as dashed shapes: H-A1, H-A2 and H-A3 recorded at level 4.',
      blocks: [
        cl('H-A1'),
        cl('H-A2'),
        cl('H-A3'),
        ctx('Each explanation is recorded at the same step as its rivals. Each says what would support or refute it, and draws what it predicts on the case map as a dashed footprint.', 'PROPOSAL', 'PROPOSAL: PRODUCT.md 2.4 level 4 requires alternatives; DECISIONS.md section 4.'),
        lim('None of the three is established. SIM registration records (E4) and a result from outside the analysis are still missing.'),
      ],
      exhibits: [{ kind: 'hypothesis', refId: 'H-A1' }, { kind: 'hypothesis', refId: 'H-A2' }, { kind: 'hypothesis', refId: 'H-A3' }],
    },
    {
      stage: 4,
      title: 'Checks requested, and what has not returned',
      trigger: { kind: 'collect', source: 'E4' },
      actionLabel: 'Request SIM registration records',
      stageAnnounce: 'Stage 4, Test: evidence from outside the analysis is requested.',
      blocks: [
        cl('H-A1'),
        ctx(`Two things are requested: registration records for the ${simsG} SIMs (E4), and a field survey of the band with a controlled test call (E6). In this case the registration records never return.`, 'FICTION', 'FICTION: prepared case data (DECISIONS.md section 4).'),
        lim('While nothing has returned, the three explanations stay open with equal standing in the record.'),
      ],
      exhibits: [{ kind: 'expectation', refId: 'EXP-A-3' }, { kind: 'expectation', refId: 'EXP-A-4' }],
    },
    {
      stage: 4,
      title: 'The survey and the test call',
      trigger: { kind: 'test', source: 'E6' },
      actionLabel: 'Request the field survey and test call',
      mapAnnounce: 'Verified (simulated): the H-A1 footprint is inked solid, H-A2 and H-A3 dissolve, and the survey mark appears on the case map.',
      blocks: [
        cl('H-A1'),
        ctx('The survey and the test call come from outside the analysis. In this demo they are prepared ground truth served by a demo connector and are labelled simulated.', 'FICTION', 'FICTION: prepared ground truth (PRODUCT.md 2.4 level 5; DECISIONS.md section 4).'),
        lim('H-A2 and H-A3 fell on this evidence. Registration records never returned, so who registered the SIMs is not established.'),
        lim('Nothing here concerns a real place or a real person.'),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-A-E6' }, { kind: 'hypothesis', refId: 'H-A1' }],
    },
    {
      stage: 5,
      title: 'Countersign and supervisor sign-off',
      trigger: { kind: 'signoff' },
      actionLabel: 'Sign off the verified finding',
      stageAnnounce: 'Stage 5, Sign-off: the one level 5 entry can be signed.',
      mapAnnounce: 'Seal bound to H-A1: the final area is sealed under sign-off, simulated.',
      blocks: [
        cl('H-A1'),
        ctx('Only a level 5 entry can be signed. Step one is the analyst\'s promote with a prepared reason. Step two is a check by a supervisor, a different user from the analyst, who signs or returns the entry with the failed check named.', 'PROPOSAL', 'PROPOSAL: DECISIONS.md section 6 (O2, O14), as amended by DIRECTION-CHANGE-001 (platform).'),
        lim('Signing records a judgement. It does not change any level.'),
      ],
      exhibits: [{ kind: 'assessment', refId: 'H-A1' }],
    },
    {
      stage: 6,
      title: 'Referral to the recipient roles',
      trigger: { kind: 'refer' },
      actionLabel: 'Refer the finding to the recipient roles',
      stageAnnounce: 'Stage 6, Referral: the packet goes to four simulated roles in order.',
      blocks: [
        cl('H-A1'),
        ctx('The packet goes to four roles in order: unit lead, agency head, regulator desk and law-enforcement desk, each marked as a simulated role. Who would act on such a finding in reality is not established.', 'FICTION', 'FICTION: the four recipient roles (DIRECTION-CHANGE-001; DECISIONS.md section 6).'),
        lim('The packet states findings and limits. It names no person, cites no law and is not sent outside the platform.'),
      ],
      exhibits: [{ kind: 'assessment', refId: 'H-A1' }],
    },
    {
      stage: 7,
      title: 'Outcome: signed and referred',
      trigger: { kind: 'close' },
      actionLabel: 'Close the case as signed and referred',
      stageAnnounce: 'Stage 7, Outcome: the case closes signed and referred.',
      blocks: [
        cl('H-A1'),
        cl('A-1'),
        cl('A-2'),
        cl('A-3'),
        ctx('The closing assessment lists what was established, what is only suggested and what was not established.', 'PROPOSAL', 'PROPOSAL: PRODUCT.md Part 5, Assessment.'),
        lim('Not established: who registered the SIMs, how long the equipment has operated, what the calls carried, and any intent.'),
      ],
      exhibits: [{ kind: 'assessment', refId: 'H-A1' }],
    },
  ];

  // ---- Strip ----------------------------------------------------------------------------------
  const lanes = g.groupSubIds.slice().sort();
  const laneOf = new Map(g.groupUris.map((u, i) => [u, lanes.indexOf(g.groupSubIds[i] as string)] as const));
  const t0 = Date.parse(window.start);
  const ticks: [number, number, number, string][] = g.gOrig.map((x) => {
    const start = Date.parse(x.serviceDeliveryStartTimeStamp);
    const end = x.serviceDeliveryEndTimeStamp ? Date.parse(x.serviceDeliveryEndTimeStamp) : null;
    return [Math.round((start - t0) / 60000), laneOf.get(x.listOfCallingPartyAddress) as number, end === null ? -1 : Math.round((end - start) / 1000), x.id];
  });

  const openIds = ['A-1', 'A-2', 'A-3'];
  const rules: Rule[] = ['R-1', 'R-2', 'R-3', 'R-4', 'R-7', 'R-8', 'R-10', 'R-11', 'R-12', 'R-13'].map((id) => RULE_DEFS[id] as Rule);

  return assemble({
    L,
    id: 'a',
    code: 'SS-A',
    title: 'Unusual outgoing call volume on one cell area',
    lede: 'Eight SIMs on one cell area placed an unusual number of answered calls in 72 hours. The records are read after the fact. The case sets out what they show, what they cannot show and what evidence would settle the cause.',
    window,
    meta: META.A!,
    entities: ENTITIES.A!,
    charts,
    sources: (['E1', 'E2', 'E3', 'E4', 'E5', 'E6'] as const).map((c) => SOURCES[c]),
    independence: [independence('IND-A-1', 'E1', 'E2'), independence('IND-A-2', 'E1', 'E5')],
    rules,
    indicators,
    evidenceItems,
    claims,
    hypotheses: hyps,
    expectations,
    steps,
    map: { region: plate.region, casePlate: plate.casePlate, shapes: plate.shapes, areas: plate.areas, states },
    signoff: {
      signableEntryId: 'H-A1',
      openEntries: [
        { entryId: 'A-1', level: 3, lacks: 'A second source that does not share the charging-record chain: its level 3 rests on where the records were collected only.' },
        { entryId: 'A-2', level: 3, lacks: 'Anything finer than an area: by analysis the geographic claim stops at level 3.' },
        { entryId: 'A-3', level: 1, lacks: 'A way to settle device type: fingerprints can overlap between device classes.' },
      ],
      reasonCodes: reasonCodes('H-A1', openIds, [], ['H-A2', 'H-A3']),
      supervisorChecks: SUPERVISOR_CHECKS,
    },
    recipients: RECIPIENTS,
    assessment: {
      captions: [
        { text: 'Key judgement 1, verified (simulated): SIM-box operation on one cell area (level 5).', entryIds: ['H-A1'] },
        { text: 'Key judgement 2, correlated: outgoing volume above baseline and an international shortfall on one route point the same way (level 3).', entryIds: ['A-1'] },
        { text: 'Key judgement 3, correlated: activity lies inside a band within one cell area, which is not a position (level 3).', entryIds: ['A-2'] },
      ],
      established: [
        `Records show the ${simsG} SIMs of group G placed ${nG} answered calls in 72 hours (A-1, level 1).`,
        'A field survey and a controlled test call, from outside the analysis, found one SIM box in use by those SIMs (H-A1, level 5, simulated).',
      ],
      suggested: [
        'Outgoing volume above baseline and an international shortfall on one route point the same way, on a correlation that differs in collection point only (A-1, level 3).',
        `Device information shows ${g.devices.length} devices of one model (A-3, level 1).`,
        'Activity lies inside a band within one cell area (A-2, level 3).',
      ],
      notEstablished: [
        'Collection gap: who registered the SIMs. Registration records were requested and never returned.',
        'Collection gap: how long the equipment has operated, and what the calls carried.',
        'Collection gap: any intent.',
      ],
      outcome: 'signed-and-referred',
    },
    fieldSpecs: FIELD_SPECS,
    strip: { lanes, ticks },
    records: { scscf: g.scscf, ibcf: g.ibcf },
  });
}
void RULE_FN;
