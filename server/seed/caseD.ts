// Case D: burst of calls to one premium-rate number block. No record carries a cell area. H-D1 stays at level 4.
import type { CaseFile, EvidenceItem, Expectation, Indicator, Rule } from '../../shared/types';
import { assemble, cl, ctx, lim } from './builder';
import type { ClaimDef, HypDef, MapStateDef, StepDef } from './builder';
import { ids, indicator, reasonCodes, stripOf, unsignableSteps, winOf, SUPERVISOR_CHECKS } from './common';
import { FIELD_SPECS, RECIPIENTS, SOURCES, independence } from './sources';
import { RULE_DEFS } from './rules';
import { W } from './wording';
import { DISCLAIMER } from './maps';
import type { Gen } from './records';
import { OUT_ROUTE, PREMIUM_BLOCK, TARGET_CUSTOMER } from './ident';
import { chartOf } from './charts';
import { startMs } from './records';
import { ENTITIES, META } from './meta';

const BICS = 'BICS Telco Fraud Whitepaper (vendor source, PRACTICE)';
const WIN = '72-hour window from 2031-03-25';
const TRUNK = 'business line 0147';
const BLOCK = `the premium-rate number block ${PREMIUM_BLOCK}`;

export function buildD(_seed: number, g: Gen): CaseFile {
  const L = 'D';
  const burst = g.burst;
  const nBurst = burst.length;
  const stamp = (s: string): string => s.slice(0, 16).replace('T', ' ');
  const times = burst.map((x) => x.serviceDeliveryStartTimeStamp).sort();
  const first = stamp(times[0] as string);
  const last = stamp(times[times.length - 1] as string);

  const B1 = 3;
  const indicators: Indicator[] = [
    indicator({
      L,
      id: 'I-1',
      ruleId: 'R-6',
      source: 'E1',
      description: `Answered calls from ${TRUNK} to ${BLOCK} outside business hours`,
      unit: 'calls',
      recs: burst,
      baseline: { id: 'B1', description: 'Calls from this business line to the same number block outside business hours in a 72-hour window', value: B1, population: "the line's own earlier 72-hour windows (stated aggregate, simulated)" },
    }),
  ];
  const I1 = indicators[0] as Indicator;

  const evidenceItems: EvidenceItem[] = [
    {
      simulated: true,
      id: 'EVI-D-E7',
      source: 'E7',
      title: `Reference data for the number block ${PREMIUM_BLOCK}`,
      summary: `The reference table lists the number block ${PREMIUM_BLOCK} as a premium-rate, revenue-share block (simulated tariff table).`,
      fields: { numberBlock: PREMIUM_BLOCK, tariffClass: 'premium rate, revenue share', table: 'simulated tariff table' },
      basis: 'FICTION',
      basisNote: `FICTION. That reference data on number ranges is needed to read such a burst is PRACTICE (${BICS}, via PRODUCT.md 2.2). The block sits under country code +999, which belongs to no country (ITU Operational Bulletin 1114 annex, "Reserved for future global service").`,
    },
  ];

  const claims: ClaimDef[] = [
    {
      kind: 'evidence',
      id: 'D-1',
      subject: `Calls from ${TRUNK} to ${BLOCK}`,
      versions: [
        { step: 0, level: 1, statement: W.l1('call records (E1)', `${TRUNK} placed ${nBurst} answered calls to ${BLOCK} between ${first} and ${last} on the simulated clock, outside business hours`), evidenceIds: ids(burst), sources: ['E1'], added: `${nBurst} outgoing call records to the number block entered` },
        { step: 1, level: 2, statement: W.l2('I-1', `calls to ${BLOCK} outside business hours from ${TRUNK} (${I1.value})`, I1.position, 'B1', `the line's own earlier windows, baseline ${B1}`, WIN), evidenceIds: ['I-1'], ruleId: 'R-6', sources: ['E1'], added: 'indicator I-1 against baseline B1 added' },
        { step: 3, level: 3, statement: W.l3('call records (E1)', 'the number range reference (E7)', 'a burst of calls to a number block that the reference data lists as premium-rate and revenue-share (simulated)'), evidenceIds: ['I-1', 'EVI-D-E7'], ruleId: 'R-6', sources: ['E1', 'E7'], independenceId: 'IND-D-1', added: 'reference data E7 added' },
      ],
    },
  ];

  const hyp = (id: string, name: string, rivals: string[], names: string[], innocent: boolean, support: string, refute: string, test: string): HypDef => ({
    kind: 'hypothesis',
    id,
    name,
    cites: ['D-1'],
    rivals,
    innocent,
    support,
    refute,
    tests: [
      { description: 'Office phone system logs from the customer premises', needs: 'Field survey and test call (E6)', status: 'not-returned' },
      { description: `Partner settlement data for ${BLOCK}`, needs: 'Number range reference (E7)', status: 'not-returned' },
    ],
    versions: [{ step: 5, state: 'open', level: 4, statement: W.l4(id, name, names, test), evidenceIds: ['I-1', 'EVI-D-E7'], added: 'cites D-1' }],
  });
  const hypotheses: HypDef[] = [
    hyp('H-D1', 'revenue-share abuse through a hijacked office phone system', ['H-D2', 'H-D3'], ['legitimate calling campaign', 'misconfigured automatic dialler'], false,
      'Office phone system logs showing calls the customer did not place, and settlement data showing revenue paid out on the number block.',
      'Office phone system logs showing the calls were placed by the customer on purpose, or no revenue paid out on the number block.',
      'supported by office phone system logs showing calls the customer did not place; refuted by logs showing the customer placed them on purpose.'),
    hyp('H-D2', 'legitimate calling campaign', ['H-D1', 'H-D3'], ['revenue-share abuse through a hijacked office phone system', 'misconfigured automatic dialler'], true,
      'Office phone system logs showing a scheduled campaign to the number block, ordered by the customer.',
      'Logs showing no scheduled campaign, or calls the customer did not place.',
      'supported by logs showing a scheduled campaign; refuted by logs showing calls the customer did not place.'),
    hyp('H-D3', 'misconfigured automatic dialler', ['H-D1', 'H-D2'], ['revenue-share abuse through a hijacked office phone system', 'legitimate calling campaign'], true,
      'Office phone system logs showing a dialling loop or a wrong number block in its configuration.',
      'Logs showing a correct configuration and calls placed from outside the dialler.',
      'supported by logs showing a dialling loop or a wrong number block; refuted by a correct dialler configuration.'),
  ];

  const window = winOf(L);
  const expectations: Expectation[] = [
    { id: 'EXP-D-1', what: 'A cell area on the records of the business line, in either of the two optional cell fields: no record in this case carries either.', fromSource: 'E1', ruleId: 'R-9', window, timeline: [{ step: 2, state: 'not-observed' }], limits: ['D-1', 'H-D1', 'H-D2', 'H-D3'] },
    { id: 'EXP-D-2', what: 'Office phone system logs from the customer premises, requested at stage 4: not returned.', fromSource: 'E6', ruleId: 'R-8', window, timeline: [{ step: 6, state: 'not-observed' }], limits: ['H-D1', 'H-D2', 'H-D3'] },
    { id: 'EXP-D-3', what: `Partner settlement data for ${BLOCK}, requested at stage 4: not returned.`, fromSource: 'E7', ruleId: 'R-8', window, timeline: [{ step: 6, state: 'not-observed' }], limits: ['H-D1', 'H-D2', 'H-D3'] },
  ];

  const empty: MapStateDef = { plate: 'national', area: null, shapes: [], spot: null, note: 'No geographic claim available: no record carries a cell area. SIMULATED.' };
  const states: MapStateDef[] = Array.from({ length: 11 }, () => empty);

  const allOrig = g.scscf.filter((x) => x.roleOfNode === 'originating');
  const subject = new Set(g.groupUris);
  const start = startMs(L);
  const base = { startMs: start, source: 'E1' as const, entryId: 'D-1', subject, recs: allOrig };
  const charts = [
    chartOf({
      ...base,
      id: 'CH-D-1',
      kind: 'timeseries',
      title: `Calls per hour by ${TRUNK} against comparable business lines`,
      ruleId: 'R-10',
      unit: 'calls per hour',
      xLabel: 'Hour of the window (simulated clock, from 2031-03-25 00:00)',
      yLabel: 'Calls per hour',
      bucketMinutes: 60,
      buckets: 72,
      seriesMeta: [
        { id: 'subject', label: 'Business line 0147 (calls per hour)', role: 'subject' },
        { id: 'population', label: 'All other business lines', role: 'population' },
      ],
      bandLabel: 'Ordinary range of comparable business lines',
      note: 'Hourly answered calls of the line. The band runs from the lowest to the highest hourly value of the other business lines. It is an ordering against a baseline, not a probability.',
    }),
    chartOf({
      ...base,
      id: 'CH-D-2',
      kind: 'distribution',
      title: 'Calls per business line across the business lines on the network',
      ruleId: 'R-11',
      unit: 'business lines',
      xLabel: 'Answered calls placed by one business line in the window',
      yLabel: 'Number of business lines',
      seriesMeta: [
        { id: 'population', label: 'Other business lines', role: 'population' },
        { id: 'subject', label: 'Business line 0147', role: 'subject' },
      ],
      markerLabel: 'Business line 0147',
      note: 'Each business line is counted once. The marker shows where business line 0147 sits. It is an ordering, not a probability.',
    }),
    chartOf({
      ...base,
      id: 'CH-D-3',
      kind: 'comparison',
      title: `Calls to ${BLOCK} outside business hours, per day, against the line's own usual level`,
      ruleId: 'R-14',
      unit: 'calls',
      xLabel: 'Day of the window',
      yLabel: 'Answered calls outside business hours',
      bucketMinutes: 1440,
      buckets: 3,
      recs: g.gOrig,
      categories: ['2031-03-25', '2031-03-26', '2031-03-27'],
      baselines: [B1 / 3, B1 / 3, B1 / 3],
      seriesMeta: [
        { id: 'observed', label: 'Calls in the window', role: 'observed' },
        { id: 'expected', label: "The line's own usual daily level", role: 'expected' },
      ],
      note: 'Calls to the number block outside business hours on each day, beside the line\'s own usual daily level (the stated usual count for the window, shared evenly over three days).',
    }),
  ];

  const steps: StepDef[] = [
    {
      stage: 1,
      title: 'Alert and call records',
      trigger: { kind: 'open' },
      actionLabel: 'Open the case from the alert',
      stageAnnounce: 'Stage 1, Signal: the alert opens the case and the call records of 72 hours enter the examination, after the calls were made.',
      mapAnnounce: 'The national map stays unlit: no record carries a cell area, so there is no geographic claim.',
      blocks: [
        cl('D-1'),
        ctx('The platform reads call records after the calls were made. Detection from call records happens after the calls were made, so nothing here prevents or interrupts a call.', 'RESEARCH', 'Oh et al., NDSS 2023 (RESEARCH): detection from call records and call quality works only after calls have been made (PRODUCT.md P4).'),
        lim('A record shows that a call was charged. It does not show who placed it or why.'),
      ],
      exhibits: [{ kind: 'records', refId: burst[0]!.id }],
    },
    {
      stage: 1,
      title: 'The business line against its own history',
      trigger: { kind: 'auto' },
      actionLabel: 'Compare the line with its own history',
      blocks: [
        cl('D-1'),
        ctx('A legitimate calling campaign, a misconfigured automatic dialler or a seasonal peak can produce the same burst. They are listed now and stay listed.', 'ASSUMPTION', 'ASSUMPTION: PRODUCT.md 2.2 lists legitimate call centres, diaspora calling peaks and events as lookalikes of revenue-share abuse.'),
        lim('The indicator is an ordering against the line\'s own history. It does not say who benefits from the calls.'),
      ],
      exhibits: [{ kind: 'indicator', refId: 'I-1' }, { kind: 'chart', refId: 'CH-D-1' }, { kind: 'chart', refId: 'CH-D-2' }, { kind: 'chart', refId: 'CH-D-3' }],
    },
    {
      stage: 2,
      title: 'No geographic evidence',
      trigger: { kind: 'auto' },
      actionLabel: 'Look for cell areas on the records',
      stageAnnounce: 'Stage 2, Evidence: the map stays empty because no record carries a cell area.',
      blocks: [
        cl('D-1'),
        ctx('Records of a business line carry neither of the two optional cell fields (User Location Info and Access Network Information). Both are optional, and their absence is a normal state.', 'FACT', 'ETSI TS 132 260 Table 6.1.3.3.1 lists both as optional (OC). That a business line produces call-handling server records is INFERRED (DECISIONS.md section 8).'),
        lim('No geographic claim can be made. An empty map is not a statement that the calls came from nowhere.'),
      ],
      exhibits: [{ kind: 'expectation', refId: 'EXP-D-1' }],
    },
    {
      stage: 2,
      title: 'The number block in the reference data',
      trigger: { kind: 'collect', source: 'E7' },
      actionLabel: 'Request the number range reference',
      blocks: [
        cl('D-1'),
        ctx('Reference data on number ranges comes from a different system and method than the call records. Here it lists the number block as premium-rate and revenue-share.', 'FICTION', `FICTION: the tariff table. The need for such reference data is PRACTICE (${BICS}).`),
        lim('A premium-rate block explains why a burst matters. It does not say who placed the calls or who is paid.'),
      ],
      exhibits: [{ kind: 'evidence', refId: 'EVI-D-E7' }, { kind: 'indicator', refId: 'I-1' }],
    },
    {
      stage: 2,
      title: 'A second view of the same calls',
      trigger: { kind: 'collect', source: 'E2' },
      actionLabel: 'Request international gateway records',
      blocks: [
        cl('D-1'),
        ctx(`The outgoing gateway records of the burst calls, on ${OUT_ROUTE.plain}, are a second view of the same events, from the same charging chain. They are not used as a second source and do not raise D-1.`, 'FICTION', 'FICTION: prepared case data (DECISIONS.md section 4). The IBCF record model is ETSI TS 132 260 Table 6.1.3.10.1.'),
        lim('Two records of one event are not two observations.'),
      ],
      exhibits: [{ kind: 'records', refId: g.ibcf[0]!.id }],
    },
    {
      stage: 3,
      title: 'Three competing explanations',
      trigger: { kind: 'hypotheses' },
      actionLabel: 'Record the competing explanations',
      stageAnnounce: 'Stage 3, Rivals: three explanations are recorded together at level 4.',
      blocks: [
        cl('H-D1'),
        cl('H-D2'),
        cl('H-D3'),
        ctx('Each explanation is recorded at the same step as its rivals and says what would support or refute it. With no cell area on any record there is nothing to draw on the map, so the explanations appear only as cards.', 'PROPOSAL', 'PROPOSAL: PRODUCT.md 2.4 level 4 requires alternatives; DECISIONS.md section 4.'),
        lim('None of the three is established. Office phone system logs and settlement data are still missing.'),
      ],
      exhibits: [{ kind: 'hypothesis', refId: 'H-D1' }, { kind: 'hypothesis', refId: 'H-D2' }, { kind: 'hypothesis', refId: 'H-D3' }],
    },
    {
      stage: 4,
      title: 'Checks requested',
      trigger: { kind: 'test', source: 'E6' },
      actionLabel: 'Request office phone system logs from the customer',
      stageAnnounce: 'Stage 4, Test: evidence from outside the analysis is requested.',
      blocks: [
        cl('H-D1'),
        ctx(`Two things are requested: office phone system logs from the premises of ${TARGET_CUSTOMER} and partner settlement data for the number block.`, 'FICTION', 'FICTION: prepared case data (DECISIONS.md section 4).'),
        lim('The same logs and settlement data would support or refute all three explanations.'),
      ],
      exhibits: [{ kind: 'expectation', refId: 'EXP-D-2' }, { kind: 'expectation', refId: 'EXP-D-3' }],
    },
    {
      stage: 4,
      title: 'Nothing returns',
      trigger: { kind: 'collect', source: 'E7' },
      actionLabel: 'Request partner settlement data',
      blocks: [
        cl('H-D1'),
        cl('H-D2'),
        cl('H-D3'),
        ctx('Neither request returns in this case.', 'FICTION', 'FICTION: prepared case data (DECISIONS.md section 4).'),
        lim('With nothing from outside the analysis, all three explanations hold at level 4 and none can be raised or dropped.'),
      ],
      exhibits: [{ kind: 'expectation', refId: 'EXP-D-2' }, { kind: 'expectation', refId: 'EXP-D-3' }],
    },
    ...unsignableSteps({
      firstIndex: 8,
      assessRef: 'H-D1',
      signBlocks: [cl('H-D1'), cl('H-D2'), cl('H-D3')],
      openText: 'Nothing in this case is at level 5, so no signature can be offered. Three explanations are open at level 4 with equal standing, and each lacks office phone system logs and settlement data, neither of which returned.',
      outcomeBlocks: [cl('H-D1'), cl('H-D2'), cl('H-D3'), cl('D-1')],
      notEstablished: 'Not established: who placed the calls, whether the customer ordered them, who is paid on the number block, and any intent.',
    }),
  ];
  steps[8]!.stageAnnounce = 'Stage 5, Sign-off: nothing is at level 5, so nothing can be signed.';
  steps[9]!.stageAnnounce = 'Stage 6, Referral: there is none for this case.';
  steps[10]!.stageAnnounce = 'Stage 7, Outcome: the case closes as an assessment record.';

  const lacks = 'Office phone system logs (E6) and partner settlement data (E7), neither of which returned.';
  return assemble({
    L,
    id: 'd',
    code: 'SS-D',
    title: 'Burst of calls to one high-cost number block',
    lede: 'One business line placed a burst of answered calls to a single premium-rate number block outside business hours. No record carries a cell area. The case sets out what the records show and what they cannot.',
    window,
    meta: META.D!,
    entities: ENTITIES.D!,
    charts,
    sources: (['E1', 'E2', 'E6', 'E7'] as const).map((c) => SOURCES[c]),
    independence: [independence('IND-D-1', 'E1', 'E7')],
    rules: ['R-6', 'R-8', 'R-9', 'R-10', 'R-11', 'R-14'].map((id) => RULE_DEFS[id] as Rule),
    indicators,
    evidenceItems,
    claims,
    hypotheses,
    expectations,
    steps,
    map: { region: null, casePlate: { widthKm: 12, heightKm: 12, disclaimer: DISCLAIMER, sectors: [] }, shapes: [], areas: {}, states },
    signoff: {
      signableEntryId: null,
      openEntries: [
        { entryId: 'H-D1', level: 4, lacks },
        { entryId: 'H-D2', level: 4, lacks },
        { entryId: 'H-D3', level: 4, lacks },
        { entryId: 'D-1', level: 3, lacks: 'Anything that says who placed the calls: no location evidence exists, and reference data does not say who is paid.' },
      ],
      reasonCodes: reasonCodes(null, ['D-1', 'H-D1', 'H-D2', 'H-D3']),
      supervisorChecks: SUPERVISOR_CHECKS,
    },
    recipients: RECIPIENTS,
    assessment: {
      captions: [
        { text: 'Key judgement 1: three explanations remain open at level 4, and none can be raised or dropped on this evidence.', entryIds: ['H-D1', 'H-D2', 'H-D3'] },
        { text: 'Key judgement 2, correlated: a burst to a premium-rate block outside business hours (level 3).', entryIds: ['D-1'] },
      ],
      established: [`Records show ${TRUNK} placed ${nBurst} answered calls to ${BLOCK} outside business hours (D-1, level 1).`],
      suggested: ['The burst is above the line\'s own history and the block is listed as premium-rate and revenue-share (D-1, level 3).'],
      notEstablished: [
        'Collection gap: who placed the calls and whether the customer ordered them. Office phone system logs never returned.',
        'Collection gap: who is paid on the number block. Settlement data never returned.',
        'Collection gap: where the calls came from. No record carries a cell area.',
        'Collection gap: any intent.',
      ],
      outcome: 'assessment-record',
    },
    fieldSpecs: FIELD_SPECS,
    strip: stripOf(L, g),
    records: { scscf: g.scscf, ibcf: g.ibcf },
  });
}
