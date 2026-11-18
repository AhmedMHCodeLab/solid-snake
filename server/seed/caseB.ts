// Case B: dense SIM group on one cell area. Two hypotheses stay open at level 4. Nothing reaches level 5.
import type { CaseFile, EvidenceItem, Expectation, Indicator, Rule } from '../../shared/types';
import { assemble, cl, ctx, lim } from './builder';
import type { ClaimDef, HypDef, MapStateDef, StepDef } from './builder';
import { ids, indicator, mean1, reasonCodes, stripOf, unsignableSteps, winOf, SUPERVISOR_CHECKS } from './common';
import { FIELD_SPECS, RECIPIENTS, SOURCES, independence } from './sources';
import { RULE_DEFS, RULE_FN } from './rules';
import { W } from './wording';
import { buildPlate } from './maps';
import { r } from './prng';
import type { Gen } from './records';
import { IN_ROUTES, cellName, tacOf } from './ident';
import { groupCharts } from './charts';
import { ENTITIES, META } from './meta';

const NDSS = 'Oh et al., NDSS 2023, Preventing SIM Box Fraud Using Device Model Fingerprinting (RESEARCH)';
const WIN = '72-hour window from 2031-03-11';
const ORD = 'ordinary SIMs on these cells and their neighbours (stated aggregate, simulated)';

export function buildB(seed: number, g: Gen): CaseFile {
  const L = 'B';
  const lead = g.layout!.lead.cellRef;
  const second = g.layout!.second.cellRef;
  const rn = (n: number) => (IN_ROUTES[n - 1] as { plain: string }).plain;
  const nG = g.gOrig.length;
  const simsG = g.groupUris.length;
  const counts = g.groupUris.map((u) => g.gOrig.filter((x) => x.listOfCallingPartyAddress === u).length);
  const perSim = { min: Math.min(...counts), max: Math.max(...counts) };
  const route = (n: number) => g.routes[(IN_ROUTES[n - 1] as { ref: string }).ref] ?? [];

  const plate = buildPlate(g, seed, {
    L,
    whereId: 'B-2',
    region: { lon: 51.28, lat: 25.85 },
    fps: [
      { hypId: 'H-B1', az: 95, dist: 1.5, rx: 0.25, ry: 0.22, label: 'Footprint predicted by H-B1: one installation.', derivation: 'What SIM-box operation predicts about where activity would be seen: a single installation, so a compact area. Basis ASSUMPTION.' },
      { hypId: 'H-B2', az: 80, dist: 0.9, rx: 0.5, ry: 0.35, label: 'Footprint predicted by H-B2: office premises.', derivation: 'What a call centre using cellular gateways predicts: an office area. Basis ASSUMPTION.' },
    ],
  });
  const P = plate.ids;

  const B1 = mean1(g.bgOrig, 'R-1');
  const B2 = mean1(g.bgOrig, 'R-3');
  const B3 = r(RULE_FN['R-4']!(g.bgAll, { baseline: 1 }), 2);
  const rb = g.routeBaselines;
  const routeInd = (id: string, n: number, bid: string): Indicator =>
    indicator({ L, id, ruleId: 'R-2', source: 'E2', description: `International calls received on ${rn(n)}, against the route's own usual count`, unit: 'ratio of the usual count', recs: route(n), baseline: { id: bid, description: `Calls received on ${rn(n)} in a 72-hour window`, value: rb[(IN_ROUTES[n - 1] as { ref: string }).ref] as number, population: "the route's own earlier 72-hour windows (stated aggregate, simulated)" } });
  const indicators: Indicator[] = [
    indicator({ L, id: 'I-1', ruleId: 'R-1', source: 'E1', description: 'Mean answered calls per SIM, group G', unit: 'calls per SIM', recs: g.gOrig, baseline: { id: 'B1', description: 'Mean answered calls per SIM in a 72-hour window', value: B1, population: ORD } }),
    indicator({ L, id: 'I-2', ruleId: 'R-3', source: 'E1', description: 'Mean number of different cell areas per SIM, group G', unit: 'cell areas per SIM', recs: g.gOrig, baseline: { id: 'B2', description: 'Mean number of different cell areas per SIM in a 72-hour window', value: B2, population: ORD } }),
    indicator({ L, id: 'I-3', ruleId: 'R-4', source: 'E1', description: 'Incoming call records per outgoing call record, group G', unit: 'ratio', recs: [...g.gOrig, ...g.gTerm], baseline: { id: 'B3', description: 'Incoming call records per outgoing call record', value: B3, population: ORD } }),
    routeInd('I-4', 1, 'B4'),
    routeInd('I-5', 2, 'B5'),
    routeInd('I-6', 3, 'B6'),
  ];
  const I = (id: string): Indicator => indicators.find((x) => x.id === id) as Indicator;
  const pop = (b: number) => `ordinary SIMs on these cells, baseline ${b}`;

  const evidenceItems: EvidenceItem[] = [
    {
      simulated: true,
      id: 'EVI-B-E3',
      source: 'E3',
      title: 'Device information for group G',
      summary: `Network signalling shows the ${simsG} SIMs of group G connected from ${g.devices.length} different devices of one gateway-type device model that holds several SIMs.`,
      fields: { simsObserved: simsG, distinctDevices: g.devices.length, deviceModelCode: tacOf(g.devices[0] as string), classNote: 'multi-SIM gateway type', method: 'attach and capability messages, not call records' },
      basis: 'ASSUMPTION',
      basisNote: `Method after ${NDSS}. That the operator collects it, and that a gateway-type class can be read from it, is ASSUMPTION. Device identities are built in the GSMA test range (TS.06 reporting body 00), in a block no allocating body issues.`,
    },
  ];

  const claims: ClaimDef[] = [
    {
      kind: 'evidence',
      id: 'B-1',
      subject: 'Voice activity of SIM group G',
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `the ${simsG} SIMs of group G placed ${nG} answered calls in 72 hours, between ${perSim.min} and ${perSim.max} per SIM`), evidenceIds: ids(g.gOrig), sources: ['E1'], added: `${nG} outgoing call records of group G entered` },
        { step: 1, level: 2, statement: W.l2('I-1', `mean answered calls per SIM in group G (${I('I-1').value})`, I('I-1').position, 'B1', pop(B1), WIN), evidenceIds: ['I-1'], ruleId: 'R-1', sources: ['E1'], added: 'indicator I-1 against baseline B1 added' },
        { step: 5, level: 3, statement: W.l3('call records (E1)', 'device information (E3)', `a dense SIM group placing calls from ${g.devices.length} gateway-type devices that hold several SIMs`), evidenceIds: ['I-1', 'EVI-B-E3'], ruleId: 'R-1', sources: ['E1', 'E3'], independenceId: 'IND-B-1', added: 'device information E3 added' },
      ],
    },
    {
      kind: 'evidence',
      id: 'B-2',
      subject: 'Where group G was observed (cell areas)',
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `${plate.nLead + plate.nSecond} of the ${nG} records of group G name a cell area, and all of them fall inside region R: ${plate.nLead} in ${cellName(lead)} and ${plate.nSecond} in ${cellName(second)}`), evidenceIds: ids(g.gOrig), sources: ['E1'], added: 'cell areas of group G fall inside region R' },
        { step: 3, level: 2, statement: W.l2('I-2', `mean number of different cell areas per SIM in group G (${I('I-2').value})`, I('I-2').position, 'B2', pop(B2), WIN), evidenceIds: ['I-2'], ruleId: 'R-3', sources: ['E1'], added: 'indicator I-2 and the observation area added' },
      ],
    },
  ];

  const hyp = (id: string, name: string, other: string, otherName: string, innocent: boolean, support: string, refute: string, test: string): HypDef => ({
    kind: 'hypothesis',
    id,
    name,
    cites: ['B-1', 'B-2'],
    rivals: [other],
    innocent,
    support,
    refute,
    tests: [
      { description: `SIM registration records for the ${simsG} SIMs`, needs: 'SIM registration records (E4)', status: 'not-returned' },
      { description: 'Controlled test call', needs: 'Field survey and test call (E6)', status: 'not-returned' },
    ],
    footprintShapeId: P.fps[id] as string,
    versions: [{ step: 6, state: 'open', level: 4, statement: W.l4(id, name, [otherName], test), evidenceIds: ['I-1', 'I-2', 'EVI-B-E3'], added: 'cites B-1 and B-2' }],
  });
  const hypotheses: HypDef[] = [
    hyp('H-B1', 'SIM-box operation', 'H-B2', 'call centre using cellular gateways', false,
      'An international shortfall on a route that carries the diverted traffic, few calls received by the SIMs, registration records showing no business use, or a test call that shows a local caller number.',
      'Registration records showing business use of the SIMs, or a survey that finds a staffed call centre.',
      'supported by an international shortfall on a route, or a test call showing a local caller number; refuted by registration records showing business use of the SIMs.'),
    hyp('H-B2', 'call centre using cellular gateways', 'H-B1', 'SIM-box operation', true,
      'Registration records showing a business customer, calls received by the SIMs at a rate like ordinary SIMs, and activity concentrated in office hours.',
      'A test call showing a local caller number for an international caller, or an international shortfall on a route.',
      'supported by registration records showing a business customer; refuted by a test call showing a local caller number for an international caller.'),
  ];

  const window = winOf(L);
  const expectations: Expectation[] = [
    { id: 'EXP-B-1', what: 'An international shortfall on at least one of the three routes, expected if H-B1 holds: none of the three routes is below its own usual level.', fromSource: 'E2', ruleId: 'R-2', window, timeline: [{ step: 7, state: 'not-observed' }], limits: ['B-1', 'H-B1'] },
    { id: 'EXP-B-2', what: `SIM registration records (E4) for the ${simsG} SIMs of group G, requested at stage 4: not returned.`, fromSource: 'E4', ruleId: 'R-7', window, timeline: [{ step: 8, state: 'not-observed' }], limits: ['H-B1', 'H-B2'] },
    { id: 'EXP-B-3', what: 'Result of a controlled test call (E6), requested at stage 4: not returned.', fromSource: 'E6', ruleId: 'R-8', window, timeline: [{ step: 8, state: 'not-observed' }], limits: ['H-B1', 'H-B2'] },
  ];

  const nat: MapStateDef = { plate: 'national', area: P.region, shapes: [], spot: P.region, note: 'Region R is lit. The cell values in the records of group G fall inside it. Examined after the fact. SIMULATED.' };
  const s2: MapStateDef = { plate: 'case', area: P.sec1, shapes: [], spot: P.sec1, note: `First cell area: ${cellName(lead)}. A cell area is not a position. SIMULATED.` };
  const s3: MapStateDef = { plate: 'case', area: P.obs, shapes: [[P.sec1, 'history']], spot: P.obs, note: 'Observation area: the union of 2 cell areas of one simulated site. SIMULATED.' };
  const s6: MapStateDef = { plate: 'case', area: P.obs, shapes: [[P.fps['H-B1']!, 'dashed'], [P.fps['H-B2']!, 'dashed']], spot: null, note: 'Two explanations drawn as dashed footprints: what each predicts, basis ASSUMPTION. SIMULATED.' };
  const states: MapStateDef[] = [nat, nat, s2, s3, { ...s3, spot: null }, { ...s3, spot: null }, s6, s6, s6, s6, s6, s6];

  const charts = groupCharts(g, { L: 'B', entryId: 'B-1', linksEntryId: 'B-1', group: 'group G', withRoutes: true, routeNote: 'Calls received on each route in the window, beside that route\'s own usual level. None of the three routes is below its usual level.' }, IN_ROUTES.map((x) => rb[x.ref] as number));

  const openText = 'Nothing in this case is at level 5, so no signature can be offered. Both explanations are open at level 4 with equal standing, and neither is the finding. Each lacks SIM registration records and a test call result, and neither has returned.';
  const steps: StepDef[] = [
    {
      stage: 1,
      title: 'Alert and call records',
      trigger: { kind: 'open' },
      actionLabel: 'Open the case from the alert',
      stageAnnounce: 'Stage 1, Signal: the alert opens the case and the call records of 72 hours enter the examination, after the calls were made.',
      mapAnnounce: 'Region R lit on the national map: the cell values of group G fall inside it.',
      blocks: [
        cl('B-1'),
        cl('B-2'),
        ctx('The platform reads call records after the calls were made. Detection from call records happens after the calls were made, so nothing here prevents or interrupts a call.', 'RESEARCH', `${NDSS}: detection from call records and call quality works only after calls have been made (PRODUCT.md P4).`),
        lim('A record shows that a call was charged. It does not show who placed it or why.'),
      ],
      exhibits: [{ kind: 'records', refId: g.gOrig[0]!.id }],
    },
    {
      stage: 1,
      title: 'Group G against ordinary SIMs',
      trigger: { kind: 'auto' },
      actionLabel: 'Compare group G with ordinary SIMs',
      blocks: [
        cl('B-1'),
        ctx('A call centre, a business SIM pool or a group of connected devices on one cell area can produce the same pattern. They are listed now and stay listed.', 'ASSUMPTION', `ASSUMPTION: PRODUCT.md 2.2 lists these as legitimate lookalikes. ${NDSS} argues IoT fingerprints may overlap with SIM boxes.`),
        lim('The indicator is an ordering against a baseline. It does not say what caused the volume.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-1' }, { kind: 'chart', refId: 'CH-B-1' }, { kind: 'chart', refId: 'CH-B-2' }],
    },
    {
      stage: 2,
      title: 'One cell area',
      trigger: { kind: 'auto' },
      actionLabel: 'Place the calls on the cell map',
      stageAnnounce: 'Stage 2, Evidence: the map moves from the national view to the case view.',
      mapAnnounce: `Now viewing: case view, simulated grid. First cell area: ${cellName(lead)}.`,
      blocks: [
        cl('B-2'),
        ctx(`The map first shows ${cellName(lead)}, the cell area most records name. The cell value in a record names the cell serving the call at answer. Most records carry it from the network; some carry what the device reported.`, 'FACT', 'ETSI TS 132 260 clause 5.1.9 and ETSI TS 124 229 clause 7.2A.4 (DECISIONS.md section 5).'),
        lim('A cell area is not a position. The shape drawn for it is an assumed shape: direction, width and reach are ASSUMPTION.'),
      ],
      exhibits: [{ kind: 'records', refId: g.gOrig.find((x) => x.userLocationInfo)!.id }],
    },
    {
      stage: 2,
      title: 'The observation area widens',
      trigger: { kind: 'auto' },
      actionLabel: 'Widen the observation area',
      mapAnnounce: `Observation area widened to the union of ${cellName(lead)} and ${cellName(second)}: indicator I-2 added.`,
      blocks: [
        cl('B-2'),
        ctx(`The observation area is the union of the cell areas in which the records of group G appeared, ${plate.areas[P.obs]} km2 on the simulated grid.`, 'ASSUMPTION', 'ASSUMPTION: sector shapes and the union are modelled (PRODUCT.md Part 7; DECISIONS.md section 5).'),
        lim('The observation area shows where the radio connection occurred. It does not show where any equipment is.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-2' }],
    },
    {
      stage: 2,
      title: 'International gateway records for three routes',
      trigger: { kind: 'collect', source: 'E2' },
      actionLabel: 'Request international gateway records',
      blocks: [
        cl('B-1'),
        ctx('International calls received are counted on three routes against each route\'s own baseline. None of the three is below it.', 'FICTION', 'FICTION: prepared case data. The IBCF record model is ETSI TS 132 260 Table 6.1.3.10.1.'),
        lim('These records cover three routes only. Traffic of the group, if diverted, could come from routes this source does not cover.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-4' }, { kind: 'indicator', refId: 'I-5' }, { kind: 'indicator', refId: 'I-6' }, { kind: 'chart', refId: 'CH-B-3' }],
    },
    {
      stage: 2,
      title: 'Device information',
      trigger: { kind: 'collect', source: 'E3' },
      actionLabel: 'Request device information',
      blocks: [
        cl('B-1'),
        ctx('Device information comes from network signalling, not from call records. It can narrow the type of device and never settle it: two SIM boxes from different makers share a fingerprint in the lab data, and fingerprints of connected devices may not be unique.', 'RESEARCH', `${NDSS}, lab LTE testbed (PRODUCT.md P2 and P3; DECISIONS.md N-01).`),
        lim('A gateway-type device model fits a SIM box and it fits a call centre that uses cellular gateways. This evidence does not separate them.'),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-B-E3' }, { kind: 'chart', refId: 'CH-B-4' }],
    },
    {
      stage: 3,
      title: 'Two competing explanations',
      trigger: { kind: 'hypotheses' },
      actionLabel: 'Record the competing explanations',
      stageAnnounce: 'Stage 3, Rivals: two explanations are recorded together at level 4.',
      mapAnnounce: 'Two footprints drawn as dashed shapes: H-B1 and H-B2 recorded at level 4.',
      blocks: [
        cl('H-B1'),
        cl('H-B2'),
        ctx('Each explanation is recorded at the same step as its rival. Each says what would support or refute it, and draws what it predicts on the case map as a dashed footprint.', 'PROPOSAL', 'PROPOSAL: PRODUCT.md 2.4 level 4 requires alternatives; DECISIONS.md section 4.'),
        lim('Neither is established. SIM registration records (E4) and a result from outside the analysis are still missing.'),
      ],
      exhibits: [{ kind: 'hypothesis', refId: 'H-B1' }, { kind: 'hypothesis', refId: 'H-B2' }],
    },
    {
      stage: 4,
      title: 'Predictions checked, registration records requested',
      trigger: { kind: 'collect', source: 'E4' },
      actionLabel: 'Request SIM registration records',
      stageAnnounce: 'Stage 4, Test: predictions are checked against the records already held and registration records are requested.',
      blocks: [
        cl('H-B1'),
        cl('H-B2'),
        ctx(`If H-B1 held, an international shortfall on a route would be expected, and few calls would be received by the SIMs. No route is below its baseline, and the SIMs received ${g.gTerm.length} incoming records against ${nG} outgoing.`, 'ASSUMPTION', 'ASSUMPTION: the two predictions follow PRODUCT.md P6 and 2.2; their weight is not established (U7).'),
        lim('An absence on three routes does not refute H-B1, and calls received do not refute it either. They count against it without settling it, and H-B2 fits them at least as well.'),
      ],
      exhibits: [{ kind: 'expectation', refId: 'EXP-B-1' }, { kind: 'indicator', refId: 'I-3' }],
    },
    {
      stage: 4,
      title: 'Requested evidence does not return',
      trigger: { kind: 'test', source: 'E6' },
      actionLabel: 'Request a controlled test call',
      blocks: [
        cl('H-B1'),
        cl('H-B2'),
        ctx('SIM registration records for the SIMs and a controlled test call were requested. Neither returns in this case.', 'FICTION', 'FICTION: prepared case data (DECISIONS.md section 4).'),
        lim('With nothing from outside the analysis, both explanations hold at level 4 and neither can be raised or dropped.'),
      ],
      exhibits: [{ kind: 'expectation', refId: 'EXP-B-2' }, { kind: 'expectation', refId: 'EXP-B-3' }],
    },
    ...unsignableSteps({
      firstIndex: 9,
      assessRef: 'H-B1',
      signBlocks: [cl('H-B1'), cl('H-B2')],
      openText,
      outcomeBlocks: [cl('H-B1'), cl('H-B2'), cl('B-1'), cl('B-2')],
      notEstablished: 'Not established: whether the group is a SIM-box operation or a call centre using cellular gateways, who registered the SIMs, and any intent.',
    }),
  ];
  steps[9]!.stageAnnounce = 'Stage 5, Sign-off: nothing is at level 5, so nothing can be signed.';
  steps[10]!.stageAnnounce = 'Stage 6, Referral: there is none for this case.';
  steps[11]!.stageAnnounce = 'Stage 7, Outcome: the case closes as an assessment record.';

  const open = ['B-1', 'B-2', 'H-B1', 'H-B2'];
  const lacks = 'SIM registration records (E4) and a controlled test call result (E6), neither of which returned.';
  return assemble({
    L,
    id: 'b',
    code: 'SS-B',
    title: 'Dense SIM group on one cell area',
    lede: 'About fifty SIMs on one cell area show similar calling patterns over 72 hours. The case sets out what the records can settle and what they cannot.',
    window,
    meta: META.B!,
    entities: ENTITIES.B!,
    charts,
    sources: (['E1', 'E2', 'E3', 'E4', 'E6'] as const).map((c) => SOURCES[c]),
    independence: [independence('IND-B-1', 'E1', 'E3')],
    rules: ['R-1', 'R-2', 'R-3', 'R-4', 'R-7', 'R-8', 'R-10', 'R-11', 'R-12', 'R-13'].map((id) => RULE_DEFS[id] as Rule),
    indicators,
    evidenceItems,
    claims,
    hypotheses,
    expectations,
    steps,
    map: { region: plate.region, casePlate: plate.casePlate, shapes: plate.shapes, areas: plate.areas, states },
    signoff: {
      signableEntryId: null,
      openEntries: [
        { entryId: 'H-B1', level: 4, lacks },
        { entryId: 'H-B2', level: 4, lacks },
        { entryId: 'B-1', level: 3, lacks: 'A source beyond device information that separates a SIM box from a call centre.' },
        { entryId: 'B-2', level: 2, lacks: 'Radio distance measurement or any other source that narrows the area.' },
      ],
      reasonCodes: reasonCodes(null, open),
      supervisorChecks: SUPERVISOR_CHECKS,
    },
    recipients: RECIPIENTS,
    assessment: {
      captions: [
        { text: 'Key judgement 1: two explanations remain open at level 4, and neither can be raised or dropped on this evidence.', entryIds: ['H-B1', 'H-B2'] },
        { text: 'Key judgement 2, correlated: a dense SIM group using a few gateway-type devices (level 3).', entryIds: ['B-1'] },
      ],
      established: [`Records show the ${simsG} SIMs of group G placed ${nG} answered calls in 72 hours (B-1, level 1).`],
      suggested: [
        'The group uses a small number of gateway-type devices (B-1, level 3).',
        'No route is below its baseline and the group receives calls: both count against H-B1 without refuting it, and both fit H-B2.',
      ],
      notEstablished: [
        'Collection gap: whether the group is a SIM-box operation or a call centre using cellular gateways. Both stay open at level 4.',
        'Collection gap: who registered the SIMs. Registration records were requested and never returned.',
        'Collection gap: any test call result.',
      ],
      outcome: 'assessment-record',
    },
    fieldSpecs: FIELD_SPECS,
    strip: stripOf(L, g),
    records: { scscf: g.scscf, ibcf: g.ibcf },
  });
}
