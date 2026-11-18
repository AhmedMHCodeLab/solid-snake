// A released step of a case: its narrative blocks and exhibits. Plain words on the first layer; specification names,
// media and collection points one step away in "Technical detail". Pure string builders.
import { levelAt, LEVEL_NAMES, type Assessment, type CaseSummary, type Entry, type Exhibit, type FieldSpec, type Level, type NarrativeBlock, type Step } from '../../../shared/types';
import { levelMark } from '../ui/marks';
import { chartHTML, compareRows, measureFigure, routeFigure, stripFigure } from './charts';
import { basisLabel, cap, esc, idList, lacuna, levelline, num, prose, ref, sourceCite, sourceName, windowText } from './util';

/**
 * A case view: the assessment is null until the case's last step is released. serverLevels is the platform's own
 * recomputation of every entry's level at every released step (step, then entry id). Every level drawn comes from it;
 * the authored levels in the case data are read only when a view carries no server levels (the design-system page).
 */
export type V = Omit<CaseSummary, 'assessment' | 'id' | 'code'> & { id?: string; code?: string; assessment: Assessment | null; serverLevels?: Record<string, Record<string, Level | null>> };
const entryOf = (c: V, id: string): Entry | undefined => c.claims.find((x) => x.id === id) ?? c.hypotheses.find((x) => x.id === id);
const lvl = (c: V, id: string, step: number): Level | null => {
  const at = c.serverLevels?.[step];
  if (at) return id in at ? (at[id] as Level | null) : null;
  const e = entryOf(c, id);
  return e ? levelAt(e, step) : null;
};

// ---- narrative -------------------------------------------------------------------------------------------------------
export function blockHTML(c: V, b: NarrativeBlock, step: number, idp: string): string {
  if (b.kind === 'claim') {
    const e = entryOf(c, b.entryId);
    const level = lvl(c, b.entryId, step) ?? b.level;
    const ver = e?.kind === 'evidence' ? e.versions.find((v) => v.level === level) : undefined;
    const ind = ver?.independenceId ? c.independence.find((i) => i.id === ver.independenceId) : undefined;
    return `<div class="claim claim--l${level}" data-claim="${esc(b.entryId)}" data-level="${level}">
      <span class="claim__mark">${levelMark(level, { size: 32 })}</span>
      <p class="claim__meta">${ref(b.entryId)} &middot; <span class="claim__level">Level ${level}, ${esc(LEVEL_NAMES[level])}</span></p>
      <p class="claim__text">${prose(c, b.text, idp)}</p>
      ${ind ? `<p class="claim__indep"><b>Independence.</b> ${esc(ind.statement)}</p>` : ''}
    </div>`;
  }
  if (b.kind === 'context') {
    return `<div class="context"><p class="context__basis">${basisLabel(b.basis)}</p><p class="context__text">${prose(c, b.text, idp)}</p>
      <details class="tech tech--wall"><summary>Source note</summary><p class="context__source">${esc(b.sourceNote)}</p></details></div>`;
  }
  return `<div class="limit"><span class="limit__mark">${lacuna('cannot be said here', 'wall', 40, 20)}</span><p class="limit__label">Cannot be said here</p><p class="limit__text">${prose(c, b.text, idp)}</p></div>`;
  void step;
}

// ---- exhibit card shell ----------------------------------------------------------------------------------------------
const KIND: Record<Exhibit['kind'], string> = { records: 'Call records', indicator: 'Indicator', evidence: 'Evidence', expectation: 'Collection gap', hypothesis: 'Explanation under test', assessment: 'Assessment', chart: 'Analysis' };

function provenance(c: V, x: Exhibit, level: Level | null, source?: string): string {
  const row = (k: string, val: string) => `<div class="prov__row"><dt class="prov__k">${k}</dt><dd class="prov__v">${val}</dd></div>`;
  return `<dl class="prov" aria-label="Provenance">
    ${row('Reference', ref(x.label.accession))}
    ${source ? row('Source', sourceCite(c, source)) : ''}
    ${row('Window', esc(x.label.window.replace(/,? simulated clock/, '')))}
    ${row('Level', level ? levelline(level, 16) : '<span class="prov__none">No level: an absence, recorded as a gap</span>')}
    ${row('Basis', basisLabel(x.label.basis))}
  </dl>`;
}
function technical(c: V, x: Exhibit, extra = ''): string {
  return `<details class="tech"><summary>Technical detail</summary><dl class="tech__list">
    <div><dt>Medium</dt><dd>${esc(x.label.medium)}</dd></div>
    <div><dt>Collection point</dt><dd>${esc(x.label.collectionPoint)}</dd></div>
    <div><dt>Exhibit</dt><dd>${ref(x.id)}</dd></div>
  </dl>${extra}</details>`;
  void c;
}
function card(c: V, x: Exhibit, o: { level: Level | null; title: string; body: string; source?: string; tech?: string; cls?: string; state?: 'fallen'; bound?: string }): string {
  const frame = o.state === 'fallen' ? 'card--fallen' : o.level === 4 ? 'card--l4' : o.level === 5 ? 'card--l5' : '';
  const mark = o.level ? levelMark(o.state === 'fallen' ? 4 : o.level, { size: 34, state: o.state ?? 'current' }) : lacuna(undefined, 'paper', 44, 22);
  return `<article class="card exhibit ${frame} ${o.cls ?? ''}" id="ex-${esc(x.id)}" data-exhibit="${esc(x.id)}" data-kind="${x.kind}"${o.bound ? ` data-bound="${esc(o.bound)}"` : ''}${o.level ? ` data-level="${o.level}"` : ''}${o.state === 'fallen' ? ' data-fallen="true"' : ''}>${o.level === 5 && o.state !== 'fallen' ? '<span class="card__ink" aria-hidden="true"></span>' : ''}
    <header class="card__head"><span class="card__kind">Exhibit &middot; ${esc(KIND[x.kind])}</span><span class="card__mark">${mark}</span></header>
    <h4 class="card__title">${esc(o.title)}</h4>
    <div class="card__body">${o.body}</div>
    ${o.level === 5 && o.state !== 'fallen' ? `<div class="card__signoff"><span class="card__signoff-line"></span><span class="card__signoff-text">Verified finding (exercise data)</span></div>` : ''}
    ${provenance(c, x, o.level, o.source)}
    ${technical(c, x, o.tech ?? '')}
  </article>`;
}
const recordsButton = (entryId: string, level: Level, label = 'Show the records') =>
  `<div class="recs" data-records-entry="${esc(entryId)}" data-records-level="${level}"><button class="btn btn--small" type="button" data-show-records>${esc(label)}</button><div class="recs__out" aria-live="off"></div></div>`;

// ---- exhibits by kind ------------------------------------------------------------------------------------------------
export function exhibitHTML(c: V, s: Step, x: Exhibit, idp: string): string {
  const step = s.index;
  const firstClaim = s.narrative.find((b): b is Extract<NarrativeBlock, { kind: 'claim' }> => b.kind === 'claim');
  const chart = x.kind === 'chart' ? c.charts?.find((ch) => ch.id === x.refId) : undefined;
  if (chart) {
    const l = lvl(c, chart.entryId, step);
    const rule = c.rules.find((r) => r.id === chart.ruleId);
    return `<article class="card exhibit exhibit--chart" id="ex-${esc(x.id)}" data-exhibit="${esc(x.id)}" data-kind="chart">${chartHTML(c, chart, l)}
      ${technical(c, x, rule ? `<p class="tech__p">Rule ${ref(rule.id)}: ${esc(rule.description)}</p><p class="tech__p">${esc(rule.sourceNote)}</p><p class="tech__p">Computed from ${num(chart.recordIds.length)} records: ${idList(chart.recordIds, 4)}</p>` : '')}</article>`;
  }
  if (x.kind === 'records') {
    const entryId = firstClaim?.entryId ?? '';
    const l = (entryId ? lvl(c, entryId, step) : null) ?? firstClaim?.level ?? 1;
    const held = c.sources.some((s) => s.code === 'E2') ? ` and ${num(c.recordCounts.ibcf)} international gateway records` : '';
    return card(c, x, {
      level: entryId ? lvl(c, entryId, step) : null, bound: entryId, source: 'E1',
      title: `${sourceName(c, 'E1')} of the group`,
      body: `${c.strip.ticks.length ? stripFigure(c, entryId, lvl(c, entryId, step), `${idp}-strip`) : ''}
        <p class="card__p">Reference record ${ref(x.refId)}. ${num(c.recordCounts.scscf)} call records${held} are held for this case.</p>
        ${entryId ? recordsButton(entryId, l, 'Show the call records') : ''}`,
    });
  }
  if (x.kind === 'indicator') {
    const ind = c.indicators.find((i) => i.id === x.refId);
    if (!ind) return '';
    const bound = [...c.claims].find((e) => e.versions.some((v) => v.evidenceIds.includes(ind.id)));
    const entryId = bound?.id ?? firstClaim?.entryId ?? '';
    const l = lvl(c, entryId, step);
    const siblings = c.indicators.filter((i) => i.ruleId === ind.ruleId && i.unit === 'ratio of baseline count');
    const rule = c.rules.find((r) => r.id === ind.ruleId);
    const isFirstRuleIndicator = c.indicators[0]?.id === ind.id;
    const hasComparison = s.exhibits.some((e) => e.kind === 'chart' && c.charts?.find((ch) => ch.id === e.refId)?.kind === 'comparison');
    const fig = siblings.length > 1 && ind.position === 'below' && !hasComparison
      ? routeFigure(c, siblings, entryId, l, `${idp}-route`)
      : measureFigure(c, ind, entryId, l, `${idp}-m-${ind.id}`, isFirstRuleIndicator && step <= 1);
    const ver = bound?.versions.find((v) => v.evidenceIds.includes(ind.id));
    return card(c, x, {
      level: l, bound: entryId, source: ind.source,
      title: cap(ind.description),
      body: `${fig}${ver ? recordsButton(entryId, ver.level, 'Show the records behind it') : ''}`,
      tech: rule ? `<p class="tech__p">Rule ${ref(rule.id)}, ${esc(rule.name)}: ${esc(rule.description)}</p><p class="tech__p">${esc(rule.sourceNote)}</p><p class="tech__p">Baseline ${ref(ind.baseline.id)}: ${esc(ind.baseline.description)}, ${esc(ind.baseline.population)}. Window ${esc(windowText(ind.window))}.</p><p class="tech__p">Reproducible from ${num(ind.recordIds.length)} records: ${idList(ind.recordIds, 4)}</p>` : '',
    });
  }
  if (x.kind === 'evidence') {
    const it = c.evidenceItems.find((e) => e.id === x.refId);
    if (!it) return '';
    const fields = Object.entries(it.fields).map(([k, val]) => `<div><dt>${esc(cap(k.replace(/([A-Z])/g, ' $1').toLowerCase()).replace(/\bsims\b/gi, 'SIMs'))}</dt><dd>${typeof val === 'number' ? `<span class="v">${num(val)}</span>` : esc(val)}</dd></div>`).join('');
    const bound = c.claims.find((e) => e.versions.some((v) => v.evidenceIds.includes(it.id))) ?? c.hypotheses.find((h) => h.versions.some((v) => v.evidenceIds.includes(it.id)));
    const ver = bound?.versions.find((v) => v.evidenceIds.includes(it.id));
    return card(c, x, {
      level: bound ? lvl(c, bound.id, step) : null, bound: bound?.id, source: it.source, cls: it.source === 'E6' ? 'exhibit--outside' : '',
      title: it.title,
      body: `<p class="card__p">${prose(c, it.summary, `${idp}-${it.id}`)}</p><dl class="facts">${fields}</dl>${bound && ver?.level ? recordsButton(bound.id, ver.level, 'Show the evidence behind it') : ''}`,
      tech: `<p class="tech__p">${esc(it.basisNote)}</p>`,
    });
  }
  if (x.kind === 'expectation') {
    const e = c.expectations.find((q) => q.id === x.refId);
    if (!e) return '';
    const ind = c.indicators.find((i) => i.ruleId === e.ruleId && i.source === e.fromSource && i.position === 'below');
    const st = [...e.timeline].reverse().find((t) => t.step <= step)?.state ?? 'not-observed';
    let lane = '';
    if (ind) {
      const ratio = ind.unit === 'ratio of baseline count';
      lane = compareRows([{ label: ratio ? 'This window' : 'Ratio in this window', expected: ind.baseline.value, observed: ratio ? Math.round(ind.value * ind.baseline.value) : ind.value }], ratio ? 'calls' : ind.unit, `${idp}-${e.id}`);
    } else {
      lane = `<div class="lane lane--empty"><p class="lane__label">${st === 'observed' ? 'Returned' : 'Requested, nothing returned'}</p><div class="lane__track">${st === 'observed' ? '<span class="lane__observed" style="--w:100"></span>' : `<span class="lane__expected" style="--w:100"></span><span class="lane__gap" style="--l:0;--w:100">${lacuna('nothing returned', 'paper', 60, 22)}</span>`}</div></div>`;
    }
    return card(c, x, {
      level: null, source: e.fromSource, cls: 'exhibit--gap',
      title: st === 'observed' ? 'Requested, and returned' : 'Expected, not observed',
      body: `<p class="card__p">${prose(c, e.what, `${idp}-${e.id}`)}</p>${lane}<p class="card__p card__small">This gap limits ${e.limits.map((l) => ref(l)).join(', ')}.</p>`,
    });
  }
  if (x.kind === 'hypothesis') {
    const h = c.hypotheses.find((q) => q.id === x.refId);
    if (!h) return '';
    const cur = [...h.versions].reverse().find((v) => v.step <= step);
    const server = c.serverLevels?.[step] ? lvl(c, h.id, step) : undefined;
    const fallen = server !== undefined ? server === null : cur?.state === 'fallen';
    const l = (fallen ? 4 : server ?? cur?.level ?? 4) as Level;
    const test = (t: (typeof h.tests)[number]) => `<li><span class="test__d">${esc(t.description)}</span><span class="test__s test__s--${t.status}">${t.status === 'returned' ? 'Returned' : t.status === 'not-returned' ? 'Not returned' : 'Requested'}</span></li>`;
    return card(c, x, {
      level: l, bound: h.id, state: fallen ? 'fallen' : undefined, cls: `exhibit--hyp${h.innocent ? ' exhibit--innocent' : ''}`,
      title: `${cap(h.name)}`,
      body: `<p class="card__p${l === 4 && !fallen ? ' t-hyp' : ''}">${prose(c, cur?.statement ?? '', `${idp}-${h.id}`)}</p>
        ${fallen ? `<p class="card__was">was <span class="v">4</span></p>` : ''}
        <dl class="sr-pair"><div><dt>Would support it</dt><dd>${esc(h.support)}</dd></div><div><dt>Would refute it</dt><dd>${esc(h.refute)}</dd></div></dl>
        <ul class="tests">${h.tests.map(test).join('')}</ul>
        <p class="card__p card__small">Rests on ${h.cites.map((r) => ref(r)).join(', ')}. Competes with ${h.rivals.map((r) => ref(r)).join(', ')}.</p>`,
    });
  }
  // assessment: the stage panels carry sign-off and dissemination; here, the record of what was concluded so far
  if (!c.assessment?.captions.length) return '';
  return card(c, x, { level: null, cls: 'exhibit--assessment', title: 'Assessment record', body: assessmentHTML(c, step) });
}

export function assessmentHTML(c: V, step: number): string {
  const a = c.assessment;
  if (!a) return '';
  const lv = (ids: string[]) => ids.map((id) => { const l = lvl(c, id, step); return `${ref(id)} ${l ? levelline(l, 16) : ''}`; }).join(' ');
  return `<section class="judgements" aria-label="Key judgements"><h5 class="judgements__h">Key judgements</h5><ol>${a.captions.map((k) => `<li><p>${esc(k.text)}</p><p class="judgements__bind">${lv(k.entryIds)}</p></li>`).join('')}</ol></section>
    ${a.established.length ? `<section><h5 class="judgements__h">Established</h5><ul class="plain">${a.established.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
    ${a.suggested.length ? `<section><h5 class="judgements__h">Suggested only</h5><ul class="plain">${a.suggested.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>` : ''}
    <section><h5 class="judgements__h">Collection gaps</h5><ul class="plain">${c.expectations.filter((x) => (x.timeline[x.timeline.length - 1]?.state ?? '') === 'not-observed').map((x) => `<li>${lacuna(undefined, 'paper', 28, 16)} ${esc(x.what)}</li>`).join('') || '<li>None recorded</li>'}</ul></section>
    <section><h5 class="judgements__h">Not established</h5><ul class="plain">${a.notEstablished.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`;
}

export function stepHTML(c: V, s: Step, open: boolean, idp: string): string {
  return `<details class="logstep" data-step="${s.index}" ${open ? 'open' : ''}><summary class="logstep__sum"><span class="logstep__stage">Stage ${s.stage}</span><span class="logstep__title">${esc(s.title)}</span></summary>
    <div class="logstep__body">
      <div class="logstep__narr">${s.narrative.map((b, i) => blockHTML(c, b, s.index, `${idp}-b${i}`)).join('')}</div>
      <div class="logstep__ex">${s.exhibits.map((x) => exhibitHTML(c, s, x, `${idp}-${x.id}`)).join('')}</div>
    </div></details>`;
}

// ---- the record register table -----------------------------------------------------------------------------------------
const PLAIN: Record<string, string> = {
  id: 'Record', roleOfNode: 'Direction', serviceRequestTimeStamp: 'Call requested', serviceDeliveryStartTimeStamp: 'Call answered', serviceDeliveryEndTimeStamp: 'Call ended',
  listOfCallingPartyAddress: 'Calling number', calledPartyAddress: 'Called number', listOfSubscriptionId: 'Subscription', userLocationInfo: 'Cell area (from the network)', accessNetworkInformation: 'Cell area (as carried)',
  subscriberEquipmentNumber: 'Device', causeForRecordClosing: 'How the call ended', nniInformation: 'Gateway direction', routeRef: 'Route',
};
const COLS_SCSCF = ['id', 'serviceDeliveryStartTimeStamp', 'serviceDeliveryEndTimeStamp', 'roleOfNode', 'listOfCallingPartyAddress', 'calledPartyAddress', 'userLocationInfo', 'subscriberEquipmentNumber', 'causeForRecordClosing'];
const COLS_IBCF = ['id', 'serviceDeliveryStartTimeStamp', 'serviceDeliveryEndTimeStamp', 'nniInformation', 'routeRef', 'listOfCallingPartyAddress', 'calledPartyAddress'];

/** "3D1A7_2" reads as "site 3D1A7, sector 2": a cell area, never a position. */
export const cellName = (ref: string) => { const m = /^(.+)_(\d+)$/.exec(ref); return m ? `site ${m[1]}, sector ${m[2]}` : ref; };
function cell(key: string, val: unknown): string {
  if (val === undefined || val === null || val === '') return '<span class="tbl__absent">not present</span>';
  if (key.endsWith('TimeStamp') && typeof val === 'string') return `<span class="v">${esc(val.replace('T', ' ').replace('Z', ''))}</span>`;
  if ((key === 'userLocationInfo' || key === 'accessNetworkInformation') && typeof val === 'object') return esc(cellName((val as { cellRef?: string }).cellRef ?? ''));
  if (key === 'nniInformation' && typeof val === 'object') return esc((val as { sessionDirection?: string }).sessionDirection ?? '');
  if (key === 'roleOfNode') return esc(val === 'originating' ? 'Outgoing' : 'Incoming');
  if (typeof val === 'number') return `<span class="v">${num(val)}</span>`;
  return `<span class="v v--wrap">${esc(String(val))}</span>`;
}
export function recordsTable(c: Pick<V, 'fieldSpecs'>, records: Record<string, unknown>[], caption: string, idp: string): string {
  if (!records.length) return '<p class="recs__none">No records in this set.</p>';
  const ibcf = records[0]!.recordType === 'iBCFRecord';
  const cols = ibcf ? COLS_IBCF : COLS_SCSCF;
  const spec = (k: string): FieldSpec | undefined => c.fieldSpecs.find((f) => f.key === k && f.spec.endsWith(ibcf ? '6.1.3.10.1' : '6.1.3.3.1'));
  const head = (k: string) => spec(k)?.plainName ?? PLAIN[k] ?? k;
  const numeric = (k: string) => k.endsWith('TimeStamp');
  return `<div class="tbl" role="region" aria-labelledby="${idp}-cap" tabindex="0"><table class="tbl__t"><caption id="${idp}-cap" class="tbl__cap">${esc(caption)}</caption>
    <thead><tr>${cols.map((k) => `<th scope="col" class="${numeric(k) ? 'tbl__num' : ''}">${esc(head(k))}</th>`).join('')}</tr></thead>
    <tbody>${records.map((r) => `<tr>${cols.map((k, i) => (i === 0 ? `<th scope="row"><span class="v">${esc(String(r.id))}</span></th>` : `<td class="${numeric(k) ? 'tbl__num' : ''}">${cell(k, r[k])}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>
    <details class="tech"><summary>Technical detail: field names</summary><dl class="tech__list">${cols.map((k) => { const f = spec(k); return `<div><dt>${esc(head(k))}</dt><dd>${f ? `${esc(f.specName)} <span class="ref">${f.category}</span> ${esc(f.spec)}${f.explain ? `. ${esc(f.explain)}` : ''}` : k === 'id' ? 'Record identifier of this platform' : esc(k)}</dd></div>`; }).join('')}</dl>
    <p class="tech__p">Absent optional fields are printed "not present": that is a normal state for those fields. Categories: M mandatory, OM operator mandatory, OC conditional.</p></details>`;
}
