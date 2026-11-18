// Builds Chart objects from records through the chart rules in rules.ts. A test recomputes every series the same way.
import type { AnyRecord, Basis, Chart, SourceCode } from '../../shared/types';
import { CHART_FN } from './rules';
import type { ChartCtx } from './rules';
import { IN_ROUTES } from './ident';
import { startMs } from './records';
import type { Gen } from './records';

export interface ChartSpec {
  id: string;
  kind: Chart['kind'];
  title: string;
  entryId: string;
  source: SourceCode;
  ruleId: string;
  unit: string;
  xLabel: string;
  yLabel: string;
  bucketMinutes?: number;
  buckets?: number;
  startMs: number;
  recs: AnyRecord[];
  subject: Set<string>;
  seriesMeta: { id: string; label: string; role: Chart['series'][number]['role'] }[];
  bandLabel?: string;
  markerLabel?: string;
  categories?: string[];
  routeRefs?: string[];
  baselines?: number[];
  note: string;
  basis?: Basis;
}

export function chartOf(s: ChartSpec): Chart {
  const ctx: ChartCtx = { startMs: s.startMs, bucketMinutes: s.bucketMinutes ?? 60, buckets: s.buckets ?? 72, subject: s.subject, ...(s.routeRefs ? { routeRefs: s.routeRefs } : {}), ...(s.baselines ? { baselines: s.baselines } : {}) };
  const calc = (CHART_FN[s.ruleId] as (r: AnyRecord[], c: ChartCtx) => ReturnType<(typeof CHART_FN)[string]>)(s.recs, ctx);
  const categories = s.categories ?? calc.categories;
  return {
    id: s.id,
    kind: s.kind,
    title: s.title,
    entryId: s.entryId,
    source: s.source,
    ruleId: s.ruleId,
    unit: s.unit,
    xLabel: s.xLabel,
    yLabel: s.yLabel,
    ...(s.bucketMinutes ? { bucketMinutes: s.bucketMinutes } : {}),
    ...(categories ? { categories } : {}),
    series: s.seriesMeta.map((m) => ({ id: m.id, label: m.label, role: m.role, values: calc.series[m.id] as number[] })),
    ...(calc.band && s.bandLabel ? { band: { label: s.bandLabel, ...calc.band } } : {}),
    ...(calc.marker !== undefined && s.markerLabel ? { marker: { label: s.markerLabel, value: calc.marker } } : {}),
    ...(calc.graph ? { graph: calc.graph } : {}),
    note: s.note,
    basis: s.basis ?? 'ASSUMPTION',
    recordIds: s.recs.map((x) => x.id),
  };
}

const origRecs = (g: Gen): AnyRecord[] => g.scscf.filter((x) => x.roleOfNode === 'originating');

export interface CaseChartOpts {
  L: 'A' | 'B' | 'C';
  entryId: string;
  linksEntryId: string;
  group: string;
  withRoutes: boolean;
  routeNote: string;
}

/** The charts of cases A, B and C: hourly calls, calls per SIM, route comparison (A, B) and links. */
export function groupCharts(g: Gen, o: CaseChartOpts, baselines: number[]): Chart[] {
  const L = o.L;
  const subject = new Set(g.groupUris);
  const start = startMs(L);
  const date = new Date(start).toISOString().slice(0, 10);
  const base = { startMs: start, source: 'E1' as SourceCode, entryId: o.entryId, subject };
  const out: Chart[] = [
    chartOf({
      ...base,
      id: `CH-${L}-1`,
      kind: 'timeseries',
      title: `Calls per hour by ${o.group} against comparable SIMs`,
      ruleId: 'R-10',
      unit: 'calls per SIM per hour',
      xLabel: `Hour of the window (simulated clock, from ${date} 00:00)`,
      yLabel: 'Calls per SIM per hour',
      bucketMinutes: 60,
      buckets: 72,
      recs: origRecs(g),
      seriesMeta: [
        { id: 'subject', label: `${o.group} (calls per SIM per hour)`, role: 'subject' },
        { id: 'population', label: 'All other SIMs on the same cells', role: 'population' },
      ],
      bandLabel: 'Ordinary range of comparable groups of SIMs',
      note: `Hourly answered calls of ${o.group} divided by its number of SIMs. The band runs from the lowest to the highest hourly value of comparable groups of the other SIMs. It is an ordering against a baseline, not a probability.`,
    }),
    chartOf({
      ...base,
      id: `CH-${L}-2`,
      kind: 'distribution',
      title: `Calls per SIM across the SIMs on the same cells`,
      ruleId: 'R-11',
      unit: 'SIMs',
      xLabel: 'Answered calls placed by one SIM in the window',
      yLabel: 'Number of SIMs',
      recs: origRecs(g),
      seriesMeta: [
        { id: 'population', label: 'Other SIMs', role: 'population' },
        { id: 'subject', label: `SIMs of ${o.group}`, role: 'subject' },
      ],
      markerLabel: `Average of ${o.group}`,
      note: `Each SIM is counted once. The marker shows where the average of ${o.group} sits. It is an ordering, not a probability.`,
    }),
  ];
  if (o.withRoutes) {
    out.push(
      chartOf({
        ...base,
        id: `CH-${L}-3`,
        kind: 'comparison',
        source: 'E2',
        title: 'International calls received per route against each route\'s own usual level',
        ruleId: 'R-12',
        unit: 'calls',
        xLabel: 'International route',
        yLabel: 'Answered calls received in the window',
        recs: g.ibcf,
        routeRefs: IN_ROUTES.map((x) => x.ref),
        baselines,
        categories: IN_ROUTES.map((x) => x.short),
        seriesMeta: [
          { id: 'observed', label: 'Received in the window', role: 'observed' },
          { id: 'expected', label: 'The route\'s own usual level for a window of the same length', role: 'expected' },
        ],
        note: o.routeNote,
      }),
    );
  }
  out.push(
    chartOf({
      ...base,
      id: `CH-${L}-4`,
      kind: 'links',
      entryId: o.linksEntryId,
      title: `SIMs, devices and cell areas tied together by ${o.group}`,
      ruleId: 'R-13',
      unit: 'calls',
      xLabel: 'SIMs, devices and cell areas',
      yLabel: 'Calls that tie a SIM to a device or a cell area',
      recs: g.gOrig,
      seriesMeta: [],
      note: 'A link is drawn only where a call record names both ends. Records that omit the optional device field add no device link, so a missing link is not a missing device.',
    }),
  );
  return out;
}
