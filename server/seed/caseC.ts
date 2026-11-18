// Case C: uniform short calls from one device family. H-C1 falls on registration evidence; H-C2 stands at level 4.
import type { CaseFile, EvidenceItem, Expectation, Indicator, Rule } from '../../shared/types';
import { assemble, cl, ctx, lim } from './builder';
import type { ClaimDef, HypDef, MapStateDef, StepDef } from './builder';
import { ids, indicator, mean1, reasonCodes, stripOf, unsignableSteps, winOf, SUPERVISOR_CHECKS } from './common';
import { FIELD_SPECS, RECIPIENTS, SOURCES, independence } from './sources';
import { RULE_DEFS, RULE_FN } from './rules';
import { W } from './wording';
import { buildPlate } from './maps';
import type { Gen } from './records';
import { IN_ROUTES, cellName, tacOf } from './ident';
import { groupCharts } from './charts';
import { ENTITIES, META } from './meta';

const NDSS = 'Oh et al., NDSS 2023, Preventing SIM Box Fraud Using Device Model Fingerprinting (RESEARCH)';
const WIN = '72-hour window from 2031-03-18';

export function buildC(seed: number, g: Gen): CaseFile {
  const L = 'C';
  const lead = g.layout!.lead.cellRef;
  const second = g.layout!.second.cellRef;
  const nG = g.gOrig.length;
  const simsG = g.groupUris.length;
  const route = (n: number) => g.routes[(IN_ROUTES[n - 1] as { ref: string }).ref] ?? [];
  const durs = g.gOrig.filter((x) => x.serviceDeliveryEndTimeStamp).map((x) => (Date.parse(x.serviceDeliveryEndTimeStamp as string) - Date.parse(x.serviceDeliveryStartTimeStamp)) / 1000);
  const dMin = Math.min(...durs);
  const dMax = Math.max(...durs);
  const nDist = new Set(g.gOrig.map((x) => x.calledPartyAddress)).size;

  const plate = buildPlate(g, seed, {
    L,
    whereId: 'C-2',
    region: { lon: 51.1, lat: 25.12 },
    fps: [
      { hypId: 'H-C1', az: 95, dist: 1.7, rx: 0.22, ry: 0.2, label: 'Footprint predicted by H-C1: one installation.', derivation: 'What SIM-box operation predicts about where activity would be seen: a single installation, so a compact area. Basis ASSUMPTION.' },
      { hypId: 'H-C2', az: 110, dist: 1.4, rx: 1.2, ry: 0.7, label: 'Footprint predicted by H-C2: devices spread across the observation area.', derivation: 'What a registered group of connected devices predicts: dispersed equipment, so a wide area. Basis ASSUMPTION.' },
    ],
  });
  const P = plate.ids;

  const B1 = mean1(g.bgOrig, 'R-1');
  const B2 = mean1(g.bgOrig, 'R-3');
  const B3 = mean1(g.bgOrig, 'R-5');
  const rb = g.routeBaselines;
  const rn = (n: number) => (IN_ROUTES[n - 1] as { plain: string }).plain;
  const routeInd = (id: string, n: number, bid: string): Indicator =>
    indicator({ L, id, ruleId: 'R-2', source: 'E2', description: `International calls received on ${rn(n)}, against the route's own usual count`, unit: 'ratio of the usual count', recs: route(n), baseline: { id: bid, description: `Calls received on ${rn(n)} in a 72-hour window`, value: rb[(IN_ROUTES[n - 1] as { ref: string }).ref] as number, population: "the route's own earlier 72-hour windows (stated aggregate, simulated)" } });
  const ord = 'ordinary SIMs on these cells and their neighbours (stated aggregate, simulated)';
  const indicators: Indicator[] = [
    indicator({ L, id: 'I-1', ruleId: 'R-1', source: 'E1', description: 'Mean answered calls per SIM, group G', unit: 'calls per SIM', recs: g.gOrig, baseline: { id: 'B1', description: 'Mean answered calls per SIM in a 72-hour window', value: B1, population: ord } }),
    indicator({ L, id: 'I-2', ruleId: 'R-3', source: 'E1', description: 'Mean number of different cell areas per SIM, group G', unit: 'cell areas per SIM', recs: g.gOrig, baseline: { id: 'B2', description: 'Mean number of different cell areas per SIM in a 72-hour window', value: B2, population: ord } }),
    indicator({ L, id: 'I-3', ruleId: 'R-5', source: 'E1', description: 'Different numbers called per 100 answered calls, group G', unit: 'numbers per 100 calls', recs: g.gOrig, baseline: { id: 'B3', description: 'Different numbers called per 100 answered calls', value: B3, population: ord } }),
    routeInd('I-4', 1, 'B4'),
    routeInd('I-5', 2, 'B5'),
    routeInd('I-6', 3, 'B6'),
  ];
  const I = (id: string): Indicator => indicators.find((x) => x.id === id) as Indicator;
  const pop = (b: number) => `ordinary SIMs on these cells, baseline ${b}`;

  const evidenceItems: EvidenceItem[] = [
    {
      simulated: true,
      id: 'EVI-C-E3',
      source: 'E3',
      title: 'Device information for group G',
      summary: `Network signalling shows the ${simsG} SIMs of group G connected from ${g.devices.length} different devices of one device family.`,
      fields: { simsObserved: simsG, distinctDevices: g.devices.length, deviceModelCode: tacOf(g.devices[0] as string), method: 'attach and capability messages, not call records' },
      basis: 'ASSUMPTION',
      basisNote: `Method after ${NDSS}. That several devices share one family here is ASSUMPTION: the paper measures a collision only between two SIM boxes and argues IoT fingerprints may overlap (DECISIONS.md N-01). Device identities are built in the GSMA test range (TS.06 reporting body 00), in a block no allocating body issues.`,
    },
    {
      simulated: true,
      id: 'EVI-C-E4',
      source: 'E4',
      title: 'SIM registration records for group G',
      summary: `The registration records show the ${simsG} SIMs of group G are covered by one business contract for connected devices.`,
      fields: { contractRef: 'EC-0211/CD-01', contractClass: 'business contract for connected devices', simsCovered: simsG, holder: 'business customer 0211' },
      basis: 'ASSUMPTION',
      basisNote: 'ASSUMPTION: registration data is held by subscriber administration and can be requested (PRODUCT.md Part 3). The contract is FICTION. Registration data can be false (DECISIONS.md section 4).',
    },
  ];

  const claims: ClaimDef[] = [
    {
      kind: 'evidence',
      id: 'C-1',
      subject: 'Voice activity of SIM group G',
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `the ${simsG} SIMs of group G placed ${nG} answered calls in 72 hours, each lasting between ${dMin} and ${dMax} seconds`), evidenceIds: ids(g.gOrig), sources: ['E1'], added: `${nG} outgoing call records of group G entered` },
        { step: 1, level: 2, statement: W.l2('I-1', `mean answered calls per SIM in group G (${I('I-1').value})`, I('I-1').position, 'B1', pop(B1), WIN), evidenceIds: ['I-1'], ruleId: 'R-1', sources: ['E1'], added: 'indicator I-1 against baseline B1 added' },
        { step: 4, level: 3, statement: W.l3('call records (E1)', 'device information (E3)', `uniform short calls from SIMs that connect from ${g.devices.length} devices of one device family`), evidenceIds: ['I-1', 'EVI-C-E3'], ruleId: 'R-1', sources: ['E1', 'E3'], independenceId: 'IND-C-1', added: 'device information E3 added' },
      ],
    },
    {
      kind: 'evidence',
      id: 'C-2',
      subject: 'Where group G was observed (cell areas)',
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `${plate.nLead + plate.nSecond} of the ${nG} records of group G name a cell area, and all of them fall inside region R: ${plate.nLead} in ${cellName(lead)} and ${plate.nSecond} in ${cellName(second)}`), evidenceIds: ids(g.gOrig), sources: ['E1'], added: 'cell areas of group G fall inside region R' },
        { step: 3, level: 2, statement: W.l2('I-2', `mean number of different cell areas per SIM in group G (${I('I-2').value})`, I('I-2').position, 'B2', pop(B2), WIN), evidenceIds: ['I-2'], ruleId: 'R-3', sources: ['E1'], added: 'indicator I-2 and the observation area added' },
      ],
    },
  ];

  const tests = (a: 'returned' | 'not-returned') => [
    { description: `SIM registration records for the ${simsG} SIMs`, needs: 'SIM registration records (E4)', status: a },
  ];
  const hypotheses: HypDef[] = [
    {
      kind: 'hypothesis',
      id: 'H-C1',
      name: 'SIM-box operation',
      cites: ['C-1', 'C-2'],
      rivals: ['H-C2'],
      innocent: false,
      support: 'Many different called numbers, an international shortfall on a route, and registration records showing no business use of the SIMs.',
      refute: 'Registration records showing business use of the SIMs, a very small set of called numbers, or no route below its baseline.',
      tests: [...tests('returned'), { description: 'Called numbers against what the explanation predicts', needs: 'Call records (E1)', status: 'returned' }],
      footprintShapeId: P.fps['H-C1'] as string,
      versions: [
        { step: 5, state: 'open', level: 4, statement: W.l4('H-C1', 'SIM-box operation', ['registered group of connected devices'], 'supported by many different called numbers and an international shortfall; refuted by registration records showing business use of the SIMs.'), evidenceIds: ['I-1', 'I-2', 'EVI-C-E3'], added: 'cites C-1 and C-2' },
        { step: 7, state: 'fallen', level: null, statement: W.fell('H-C1', 'SIM-box operation', 'the registration records (E4) show one business contract for connected devices covering the SIMs, the set of called numbers is very small and no route shows a shortfall'), evidenceIds: ['EVI-C-E4', 'I-3', 'I-4', 'I-5', 'I-6'], added: 'registration evidence E4 contradicts it, with indicator I-3 and no route shortfall' },
      ],
    },
    {
      kind: 'hypothesis',
      id: 'H-C2',
      name: 'registered group of connected devices',
      cites: ['C-1', 'C-2'],
      rivals: ['H-C1'],
      innocent: true,
      support: 'Registration records showing a contract for connected devices that covers the SIMs, a very small set of called numbers and no international shortfall.',
      refute: 'No such contract, many different called numbers, or a survey that finds equipment where no registered group is.',
      tests: [...tests('returned'), { description: 'Field check of the registered group', needs: 'Field survey and test call (E6)', status: 'not-returned' }],
      footprintShapeId: P.fps['H-C2'] as string,
      versions: [
        { step: 5, state: 'open', level: 4, statement: W.l4('H-C2', 'registered group of connected devices', ['SIM-box operation'], 'supported by registration records showing a contract that covers the SIMs; refuted by no such contract or many different called numbers.'), evidenceIds: ['I-1', 'I-2', 'EVI-C-E3'], added: 'cites C-1 and C-2' },
        { step: 7, state: 'open', level: 4, statement: W.l4('H-C2', 'registered group of connected devices', ['SIM-box operation (H-C1, fell at stage 4)'], 'supported by the contract in the registration records (E4) and a very small set of called numbers; refuted by a field check, not yet made, that finds equipment where no registered group is.'), evidenceIds: ['EVI-C-E4', 'I-3'], added: 'registration evidence E4 supports it' },
      ],
    },
  ];

  const window = winOf(L);
  const expectations: Expectation[] = [
    { id: 'EXP-C-1', what: 'An international shortfall on at least one of the three routes, expected if H-C1 holds: none of the three routes is below its own usual level.', fromSource: 'E2', ruleId: 'R-2', window, timeline: [{ step: 6, state: 'not-observed' }], limits: ['C-1', 'H-C1'] },
    { id: 'EXP-C-2', what: `Many different called numbers from the group, expected if H-C1 holds: ${nDist} different numbers in ${nG} calls, ${I('I-3').value} per 100 against a baseline of ${B3}.`, fromSource: 'E1', ruleId: 'R-5', window, timeline: [{ step: 6, state: 'not-observed' }], limits: ['C-1', 'H-C1'] },
    { id: 'EXP-C-3', what: `SIM registration records (E4) for the ${simsG} SIMs of group G, requested at stage 4.`, fromSource: 'E4', ruleId: 'R-7', window, timeline: [{ step: 6, state: 'not-observed' }, { step: 7, state: 'observed' }], limits: ['H-C1', 'H-C2'] },
    { id: 'EXP-C-4', what: 'A result from outside the analysis (E6) that would verify the registered group: none exists in this case.', fromSource: 'E6', ruleId: 'R-8', window, timeline: [{ step: 7, state: 'not-observed' }], limits: ['H-C2'] },
  ];

  const nat: MapStateDef = { plate: 'national', area: P.region, shapes: [], spot: P.region, note: 'Region R is lit. The cell values in the records of group G fall inside it. Examined after the fact. SIMULATED.' };
  const s2: MapStateDef = { plate: 'case', area: P.sec1, shapes: [], spot: P.sec1, note: `First cell area: ${cellName(lead)}. A cell area is not a position. SIMULATED.` };
  const s3: MapStateDef = { plate: 'case', area: P.obs, shapes: [[P.sec1, 'history']], spot: P.obs, note: 'Observation area: the union of 2 cell areas of one simulated site. SIMULATED.' };
  const s5: MapStateDef = { plate: 'case', area: P.obs, shapes: [[P.fps['H-C1']!, 'dashed'], [P.fps['H-C2']!, 'dashed']], spot: null, note: 'Two explanations drawn as dashed footprints: what each predicts, basis ASSUMPTION. SIMULATED.' };
  const s7: MapStateDef = { plate: 'case', area: P.obs, shapes: [[P.fps['H-C1']!, 'dissolved'], [P.fps['H-C2']!, 'dashed']], spot: P.fps['H-C2']!, note: 'The H-C1 footprint dissolved. The H-C2 footprint stays dashed: it is not verified outside the analysis. SIMULATED.' };
  const states: MapStateDef[] = [nat, nat, s2, s3, { ...s3, spot: null }, s5, s5, s7, { ...s7, spot: null }, { ...s7, spot: null }, { ...s7, spot: null }];

  const charts = groupCharts(g, { L: 'C', entryId: 'C-1', linksEntryId: 'C-1', group: 'group G', withRoutes: false, routeNote: '' }, []);

  const steps: StepDef[] = [
    {
      stage: 1,
      title: 'Alert and call records',
      trigger: { kind: 'open' },
      actionLabel: 'Open the case from the alert',
      stageAnnounce: 'Stage 1, Signal: the alert opens the case and the call records of 72 hours enter the examination, after the calls were made.',
      mapAnnounce: 'Region R lit on the national map: the cell values of group G fall inside it.',
      blocks: [
        cl('C-1'),
        cl('C-2'),
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
        cl('C-1'),
        ctx('A call centre, a business SIM pool or a group of connected devices on one cell area can produce the same pattern. They are listed now and stay listed.', 'ASSUMPTION', `ASSUMPTION: PRODUCT.md 2.2 lists these as legitimate lookalikes. ${NDSS} argues IoT fingerprints may overlap with SIM boxes.`),
        lim('The indicator is an ordering against a baseline. It does not say what caused the volume.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-1' }, { kind: 'chart', refId: 'CH-C-1' }, { kind: 'chart', refId: 'CH-C-2' }],
    },
    {
      stage: 2,
      title: 'One cell area',
      trigger: { kind: 'auto' },
      actionLabel: 'Place the calls on the cell map',
      stageAnnounce: 'Stage 2, Evidence: the map moves from the national view to the case view.',
      mapAnnounce: `Now viewing: case view, simulated grid. First cell area: ${cellName(lead)}.`,
      blocks: [
        cl('C-2'),
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
        cl('C-2'),
        ctx(`The observation area is the union of the cell areas in which the records of group G appeared, ${plate.areas[P.obs]} km2 on the simulated grid.`, 'ASSUMPTION', 'ASSUMPTION: sector shapes and the union are modelled (PRODUCT.md Part 7; DECISIONS.md section 5).'),
        lim('The observation area shows where the radio connection occurred. It does not show where any equipment is.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-2' }],
    },
    {
      stage: 2,
      title: 'Device information',
      trigger: { kind: 'collect', source: 'E3' },
      actionLabel: 'Request device information',
      blocks: [
        cl('C-1'),
        ctx('Device information comes from network signalling, not from call records. It can narrow the type of device and never settle it: two SIM boxes from different makers share a fingerprint in the lab data, and fingerprints of connected devices may not be unique.', 'RESEARCH', `${NDSS}, lab LTE testbed (PRODUCT.md P2 and P3; DECISIONS.md N-01).`),
        lim('A shared device family fits a SIM box and it fits a registered group of connected devices. This evidence does not separate them.'),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-C-E3' }, { kind: 'chart', refId: 'CH-C-4' }],
    },
    {
      stage: 3,
      title: 'Two competing explanations',
      trigger: { kind: 'hypotheses' },
      actionLabel: 'Record the competing explanations',
      stageAnnounce: 'Stage 3, Rivals: two explanations are recorded together at level 4.',
      mapAnnounce: 'Two footprints drawn as dashed shapes: H-C1 and H-C2 recorded at level 4.',
      blocks: [
        cl('H-C1'),
        cl('H-C2'),
        ctx('Each explanation is recorded at the same step as its rival. Each says what would support or refute it, and draws what it predicts on the case map as a dashed footprint.', 'PROPOSAL', 'PROPOSAL: PRODUCT.md 2.4 level 4 requires alternatives; DECISIONS.md section 4.'),
        lim('Neither is established. SIM registration records (E4) are still missing.'),
      ],
      exhibits: [{ kind: 'hypothesis', refId: 'H-C1' }, { kind: 'hypothesis', refId: 'H-C2' }],
    },
    {
      stage: 4,
      title: 'What H-C1 predicted, checked against the records held',
      trigger: { kind: 'auto' },
      actionLabel: 'Check the predictions against the records held',
      stageAnnounce: 'Stage 4, Test: predictions are checked and registration records are about to be requested.',
      blocks: [
        cl('H-C1'),
        ctx(`If H-C1 held, many different called numbers and an international shortfall on a route would be expected. The group called ${nDist} different numbers in ${nG} calls, and no route is below its baseline.`, 'ASSUMPTION', 'ASSUMPTION: the two predictions follow PRODUCT.md P6 and 2.2; their weight is not established (U7).'),
        lim('These two absences count against H-C1. Registration records have not yet been requested, so H-C1 still stands at level 4 at this step.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-3' }, { kind: 'expectation', refId: 'EXP-C-1' }, { kind: 'expectation', refId: 'EXP-C-2' }, { kind: 'expectation', refId: 'EXP-C-3' }],
    },
    {
      stage: 4,
      title: 'Registration records return',
      trigger: { kind: 'collect', source: 'E4' },
      actionLabel: 'Request SIM registration records',
      mapAnnounce: 'The H-C1 footprint dissolved: registration evidence E4 contradicts H-C1. The H-C2 footprint stays dashed.',
      blocks: [
        cl('H-C2'),
        ctx('The registration records show one business contract for connected devices covering the SIMs. They come from a different system and method than the call records.', 'ASSUMPTION', 'ASSUMPTION: registration data can be requested and returned (PRODUCT.md Part 3). The contract is FICTION. Registration data can be false (DECISIONS.md section 4).'),
        lim('H-C1 no longer holds and is struck, and its earlier level stays on record. H-C2 stands at level 4: nothing from outside the analysis has verified it.'),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-C-E4' }, { kind: 'hypothesis', refId: 'H-C1' }, { kind: 'hypothesis', refId: 'H-C2' }, { kind: 'expectation', refId: 'EXP-C-4' }],
    },
    ...unsignableSteps({
      firstIndex: 8,
      assessRef: 'H-C2',
      signBlocks: [cl('H-C2'), cl('C-1')],
      openText: 'Nothing in this case is at level 5, so no signature can be offered. H-C2 is open at level 4: the registration records came from inside the analysis chain, and no result from outside it has been requested.',
      outcomeBlocks: [cl('H-C2'), cl('C-1'), cl('C-2')],
      notEstablished: 'Not established: that the connected devices operate as registered, what the calls carry, and any intent. On this evidence the group is not shown to be fraud.',
    }),
  ];
  steps[8]!.stageAnnounce = 'Stage 5, Sign-off: nothing is at level 5, so nothing can be signed.';
  steps[9]!.stageAnnounce = 'Stage 6, Referral: there is none for this case.';
  steps[10]!.stageAnnounce = 'Stage 7, Outcome: the case closes as an assessment record.';

  return assemble({
    L,
    id: 'c',
    code: 'SS-C',
    title: 'Uniform short calls from one device family',
    lede: 'Twenty-four SIMs on one cell area place short calls of near-equal length to a handful of numbers. The case sets out what the records suggest, and what changes when more evidence arrives.',
    window,
    meta: META.C!,
    entities: ENTITIES.C!,
    charts,
    sources: (['E1', 'E2', 'E3', 'E4', 'E6'] as const).map((c) => SOURCES[c]),
    independence: [independence('IND-C-1', 'E1', 'E3')],
    rules: ['R-1', 'R-2', 'R-3', 'R-5', 'R-7', 'R-8', 'R-10', 'R-11', 'R-13'].map((id) => RULE_DEFS[id] as Rule),
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
        { entryId: 'H-C2', level: 4, lacks: 'A result from outside the analysis (E6) for the registered group. The registration records came from inside the chain.' },
        { entryId: 'C-1', level: 3, lacks: 'Nothing further is needed for the level it holds; it does not settle which explanation applies.' },
        { entryId: 'C-2', level: 2, lacks: 'Radio distance measurement or any other source that narrows the area.' },
      ],
      reasonCodes: reasonCodes(null, ['C-1', 'C-2', 'H-C2'], [], ['H-C1']),
      supervisorChecks: SUPERVISOR_CHECKS,
    },
    recipients: RECIPIENTS,
    assessment: {
      captions: [
        { text: 'Key judgement 1: not fraud on this evidence.', entryIds: ['H-C1', 'H-C2', 'C-1'] },
        { text: 'Key judgement 2: registered use of connected devices explains the group at level 4, not verified outside the analysis.', entryIds: ['H-C2'] },
      ],
      established: [
        `Records show the ${simsG} SIMs of group G placed ${nG} answered calls of ${dMin} to ${dMax} seconds in 72 hours (C-1, level 1).`,
        'The registration records show one business contract for connected devices covering the SIMs (E4).',
      ],
      suggested: [
        `The group is a registered set of connected devices (H-C2, level 4). It called ${nDist} different numbers and no route is below its baseline.`,
        'The SIMs connect from devices of one family (C-1, level 3).',
      ],
      notEstablished: [
        'Collection gap: that the connected devices operate as registered. There is no result from outside the analysis.',
        'Collection gap: what the calls carry, and any intent.',
        'H-C1 fell: SIM-box operation is not supported on this evidence.',
      ],
      outcome: 'assessment-record',
    },
    fieldSpecs: FIELD_SPECS,
    strip: stripOf(L, g),
    records: { scscf: g.scscf, ibcf: g.ibcf },
  });
}
void RULE_FN;
