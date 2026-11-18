// The console: monitor, alert to case, the case workflow, sign-off, dissemination, audit.
// Pages are rendered client-side from the platform API. Only state changes the motion contract names animate:
// level changes, stage transitions, map uncertainty and scale changes, the spotlight moving. Each names what changed.
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import '../styles/index.css';
import './console.css';
import { STAGE_NAMES, type ConnectorInfo, type Level, type MapShape, type SourceCode, type StageId } from '../../../shared/types';
import { api, ApiError, currentUser, newWorkspace, setUser, type Alert, type CaseRow, type CaseView, type FeedStatus, type Session } from '../api/client';
import { timeseries } from '../render/charts';
import { assessmentHTML, recordsTable, stepHTML } from '../render/exhibits';
import { buildModel, entryStatus, type Model } from '../render/model';
import { registerCounts, registerHTML, tallyHTML } from '../render/register';
import { cap, esc, lacuna, levelline, num, ref, sourceName, STAGE_LEDES } from '../render/util';
import { defsSprite, STROKES_BY_LEVEL } from '../ui/marks';
import { DURATION, EASE } from '../ui/motion';
import { MapView } from './map';

gsap.registerPlugin(Flip);
const reduceMq = matchMedia('(prefers-reduced-motion: reduce)');
const reduce = () => reduceMq.matches;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const main = $('panel-main');
const side = $('panel-side');
const live = $('live');
const shell = $('shell');
document.body.insertAdjacentHTML('afterbegin', defsSprite());

// ---- state -------------------------------------------------------------------------------------------------------
let session: Session | null = null;
let feed: FeedStatus | null = null;
let alerts: Alert[] = [];
let cases: CaseRow[] = [];
let cv: CaseView | null = null;
let model: Model | null = null;
let openRef: string | null = null;
let caseTab: 'workflow' | 'audit' = 'workflow';
let focusAlert: string | null = null;
let notice = '';
/** Set when the platform refuses a write because the workspace's audit trail fails verification. */
let chainBroken = false;
const brokenHTML = () => `<p class="refusal" id="chain-broken">The audit trail of this workspace fails verification, so nothing more can be recorded in it. It is kept as it is, for investigation. <button class="btn btn--small" type="button" data-newws>Start a new demo workspace</button></p>`;
const ruleNames = new Map<string, string>();
const map = new MapView($('map'), reduce);

const role = () => session?.users.find((u) => u.id === currentUser())?.role ?? 'analyst';
const userName = (id: string) => session?.users.find((u) => u.id === id)?.displayName ?? id;
const announce = (t: string) => { live.textContent = ''; requestAnimationFrame(() => (live.textContent = t)); };
const fmtTime = (iso: string) => iso.replace('T', ' ').slice(0, 16);
const dur = (min: number) => (min >= 1440 ? `${+(min / 1440).toFixed(1)} days` : min >= 60 ? `${+(min / 60).toFixed(1)} hours` : `${min} minutes`);
const connector = (s: SourceCode): ConnectorInfo | undefined => session?.connectors.find((c) => c.source === s);
const STATUS: Record<CaseRow['status'], string> = { open: 'Open', 'awaiting-collection': 'Awaiting a source', 'awaiting-test': 'Awaiting the outside check', 'awaiting-sign-off': 'Ready for sign-off', 'awaiting-assessment': 'Ready for assessment', 'awaiting-supervisor': 'Awaiting countersignature', referred: 'Signed and referred', 'closed-assessment': 'Closed with an assessment record' };

// ---- top bar -----------------------------------------------------------------------------------------------------
function setTheme(t: 'dark' | 'light') {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('ss-theme', t); } catch { /* not remembered in private mode */ }
  const b = $('theme');
  b.setAttribute('aria-pressed', String(t === 'light'));
  b.textContent = t === 'light' ? 'Dark theme' : 'Light theme';
}
setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
$('theme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

function renderAccount() {
  const s = $<HTMLSelectElement>('acct');
  s.innerHTML = (session?.users ?? []).map((u) => `<option value="${esc(u.id)}"${u.id === currentUser() ? ' selected' : ''}>${esc(u.displayName)} (${esc(u.role)})</option>`).join('');
}
$<HTMLSelectElement>('acct').addEventListener('change', (e) => {
  setUser((e.target as HTMLSelectElement).value);
  announce(`Signed in as ${userName(currentUser() ?? '')}.`);
  notice = '';
  void refresh(false);
});

function renderTabs() {
  const here = location.hash || '#monitor';
  $('tabs').innerHTML = `<a class="tabs__a" href="#monitor"${here === '#monitor' ? ' aria-current="page"' : ''}>Monitor</a>${cases
    .map((c) => { const h = `#case/${encodeURIComponent(c.ref)}`; return `<a class="tabs__a" href="${h}"${here.startsWith(h) ? ' aria-current="page"' : ''}><span class="v">${esc(c.ref)}</span></a>`; })
    .join('')}`;
}
function renderClock() {
  $('clock-v').textContent = feed ? `${fmtTime(feed.cursor)} (${feed.state === 'running' ? 'running' : feed.state === 'done' ? 'window replayed' : feed.state})` : 'waiting';
}

// ---- monitor -----------------------------------------------------------------------------------------------------
// Replay speeds in feed minutes per wall second, sized to the feed window the service reports.
const speeds = (f: FeedStatus | null): [number, string][] => {
  const min = f ? (Date.parse(f.window.end) - Date.parse(f.window.start)) / 60_000 : 4320;
  return [[Math.round(min / 180), 'Standard: the window in about 3 minutes'], [Math.round(min / 45), 'Fast: about 45 seconds'], [Math.round(min / 12), 'Very fast: about 12 seconds']];
};
let speed = 0;
let resetArmed = false;
function ingestChart(f: FeedStatus): string {
  const start = Date.parse(f.window.start);
  const n = Math.max(1, Math.ceil((Date.parse(f.window.end) - start) / 900_000));
  const vals = Array.from({ length: n }, () => 0);
  for (const b of f.buckets) { const i = Math.floor((Date.parse(b.start) - start) / 900_000); if (i >= 0 && i < n) vals[i] = b.count; }
  const c = { sources: [{ code: 'E1' as SourceCode, name: 'Call records', plainName: 'Call records', system: '', method: '', collectionPoint: '', basis: 'FICTION' as const, basisNote: '' }], window: f.window, strip: { lanes: [], ticks: [] }, indicators: [], entities: [] };
  return timeseries(c, { id: 'ingest', kind: 'timeseries', title: 'Records ingested per 15 minutes of feed time', entryId: '', source: 'E1', ruleId: '', unit: 'records per 15 minutes', xLabel: 'Feed time, days from the start of the window', yLabel: 'Records', bucketMinutes: 15, series: [{ id: 's', label: 'Records ingested', role: 'subject', values: vals }], note: 'Every ingested record passes through the detection rules.', basis: 'FICTION', recordIds: [] }, null);
}
function renderMonitorMain() {
  const f = feed;
  const pct = f && f.total ? Math.round((f.ingested / f.total) * 100) : 0;
  main.innerHTML = `${chainBroken || session?.workspace.audit?.ok === false ? brokenHTML() : ''}<header class="phead"><p class="phead__k">Monitor</p><h1 class="phead__t">Call records, as they are ingested</h1>
    <p class="phead__lede">The feed replays a synthetic window of call records in the format an operator exports. Detection rules run over every record. When a rule fires, an alert joins the queue.</p></header>
    <section class="block" aria-labelledby="feed-h"><h2 class="block__h" id="feed-h">Feed</h2>
      <div class="feed">
        <p class="feed__state"><span class="feed__dot feed__dot--${f?.state ?? 'idle'}" aria-hidden="true"></span>${esc(f ? { idle: 'Not started', running: 'Running', paused: 'Paused', done: 'Window replayed' }[f.state] : 'Connecting')}</p>
        <p class="feed__count"><span class="feed__n v">${num(f?.ingested ?? 0)}</span> of <span class="v">${num(f?.total ?? 0)}</span> records ingested <span class="feed__pct">${pct}%</span></p>
        <div class="meter" aria-hidden="true"><span style="--w:${pct}"></span></div>
        <div class="actions">
          ${f?.state === 'running' ? '<button class="btn btn--primary" type="button" data-feed="pause">Pause the feed</button>' : `<button class="btn btn--primary" type="button" data-feed="start"${f?.state === 'done' ? ' disabled' : ''}>${f?.state === 'paused' ? 'Resume the feed' : 'Start the feed'}</button>`}
          <label class="sel"><span class="sel__k">Replay speed</span><select data-feed="speed">${speeds(f).map(([v, t], i) => `<option value="${v}"${v === speed || (!speed && i === 0) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
          <button class="btn btn--quiet" type="button" data-feed="reset">${resetArmed ? 'Confirm: reset the demo workspace' : 'Reset demo'}</button>
        </div>
        ${f?.state === 'done' ? '<p class="note">The whole window has been replayed. Reset the demo to replay it again.</p>' : ''}
      </div>
    </section>
    <section class="block block--paper" aria-label="Ingest volume">${f ? ingestChart(f) : ''}</section>
    <section class="block" aria-labelledby="conn-h"><h2 class="block__h" id="conn-h">Source connectors</h2>
      <ul class="conns">${(session?.connectors ?? []).map((c) => `<li><span class="conns__n">${esc(c.plainName)} ${ref(c.source)}</span><span class="conns__m">${c.mode === 'live' ? 'Live' : 'Demo connector, synthetic returns'} &middot; stated turnaround ${esc(dur(c.turnaroundMinutes))}</span></li>`).join('')}</ul>
      <p class="note">No operator is connected. Each outside source answers through a demo connector that returns synthetic data; a live connector replaces it without changing anything else.</p>
    </section>`;
}
const SEV_MARK: Record<Alert['severity'], string> = { Immediate: '<span class="sev sev--imm" aria-hidden="true"></span>', Priority: '<span class="sev sev--pri" aria-hidden="true"></span>', Routine: '<span class="sev sev--rou" aria-hidden="true"></span>' };
function alertHTML(a: Alert): string {
  const d = a.detection;
  const regionName = a.region ? `${regionOf(a.region)}, drawn on the map as an area of stated uncertainty` : a.regionShapeId ? 'Not drawn: no source evidence is bound to this alert in the demo' : 'No region: the detection is not tied to a cell area';
  const st = a.status === 'new' ? 'New' : a.status === 'case-opened' ? 'Case opened' : 'Dismissed';
  // The server says when a case is already open on the same evidence; the alert then links to it rather than opening a duplicate.
  const linked = a.status === 'new' && a.relatedCaseRef ? { caseRef: a.relatedCaseRef } : undefined;
  const reasons = session?.dismissReasons ?? [];
  return `<li class="alert alert--${a.status}" data-alert="${esc(a.id)}" data-region="${esc(a.region?.shapeId ?? '')}">
    <article class="alert__card" aria-labelledby="${esc(a.id)}-t">
      <header class="alert__head"><span class="alert__sev">${SEV_MARK[a.severity]}${esc(a.severity)}</span><span class="alert__time v">${esc(fmtTime(d.at))}</span></header>
      <h3 class="alert__t" id="${esc(a.id)}-t">${esc(a.title)}</h3>
      <dl class="alert__dl">
        <div><dt>Rule</dt><dd>${esc(ruleNames.get(d.ruleId) ?? 'Detection rule')} ${ref(d.ruleId)}</dd></div>
        <div><dt>Value</dt><dd><span class="v">${num(d.value)}</span> ${esc(d.unit)}, ${d.position} the baseline of <span class="v">${num(d.baseline.value)}</span></dd></div>
        <div><dt>Subject</dt><dd>${esc(d.subject.plainName)}</dd></div>
        <div><dt>Region</dt><dd>${esc(regionName)}</dd></div>
        <div><dt>Derivation</dt><dd>Counted over the records answered from <span class="v">${esc(fmtTime(d.window.start))}</span> to <span class="v">${esc(fmtTime(d.window.end))}</span>, <span class="v">${num(d.recordIds.length)}</span> records. Baseline read from <span class="v">${num(d.baselinePopulation.count)}</span> records: ${esc(d.baselinePopulation.description)}. <button class="btn btn--small btn--quiet" type="button" data-baseline="${esc(a.id)}">List the baseline records</button><span class="baseline__out" data-baseline-out="${esc(a.id)}"></span></dd></div>
      </dl>
      <p class="alert__note">An ordering against the baseline, not a probability. Detected after the calls were made.</p>
      <footer class="alert__foot"><span class="alert__status">${st}${a.caseRef ? ` &middot; <a href="#case/${encodeURIComponent(a.caseRef)}"><span class="v">${esc(a.caseRef)}</span></a>` : ''}</span>
        ${a.status === 'new' ? `<span class="actions">${linked ? `<a class="btn btn--small btn--primary" href="#case/${encodeURIComponent(linked.caseRef)}">Go to case <span class="v">${esc(linked.caseRef)}</span></a>` : `<button class="btn btn--small btn--primary" type="button" data-open="${esc(a.id)}">Open case</button>`}
          <details class="dismiss"><summary class="btn btn--small">Dismiss</summary><div class="dismiss__body"><p class="dismiss__k">Choose a prepared reason</p>${reasons.map((r) => `<button class="btn btn--small btn--quiet dismiss__r" type="button" data-dismiss="${esc(a.id)}" data-reason="${esc(r.code)}">${esc(r.label)}</button>`).join('')}</div></details></span>` : ''}
      </footer>
      ${linked ? `<p class="alert__link">Draws on the same evidence as case <span class="v">${esc(linked.caseRef)}</span>. Work it there, or dismiss this alert as a duplicate.</p>` : ''}
    </article></li>`;
}
function renderQueue() {
  const n = alerts.filter((a) => a.status === 'new').length;
  side.setAttribute('aria-label', 'Alert queue');
  side.innerHTML = `<header class="phead phead--side"><p class="phead__k">Alert queue</p><h2 class="phead__t phead__t--s"><span class="v">${n}</span> new ${n === 1 ? 'alert' : 'alerts'}</h2>
    <p class="phead__lede phead__lede--s">Newest first. Each alert is a rule firing on the records, after the fact. It is a reason to look, not a finding.</p></header>
    ${alerts.length ? `<ol class="queue" aria-label="Alerts">${[...alerts].sort((x, y) => (x.detection.at < y.detection.at ? 1 : x.detection.at > y.detection.at ? -1 : x.id < y.id ? 1 : -1)).map(alertHTML).join('')}</ol>` : `<p class="empty">${lacuna(undefined, 'wall', 40, 20)} No alert yet. ${feed?.state === 'idle' ? 'Start the feed to begin ingesting.' : 'Rules are running over the feed.'}</p>`}`;
}
const regionOf = (r: NonNullable<Alert['region']>) => r.label.split(':')[0] ?? 'Region';
/** An alert's region as a national-plate shape. A case view later brings the fuller derivation; the plate keeps the first it learns. */
const regionShape = (a: Alert): MapShape | null => a.region && { id: a.region.shapeId, kind: 'region', plate: 'national', points: a.region.points, boundTo: '', label: a.region.label, derivation: 'The cell values carried by the records that fired the rule fall inside this region. It is drawn no finer than tens of kilometres and is not a position.', basis: 'FICTION' };

// ---- case --------------------------------------------------------------------------------------------------------
/** The released case with the platform's own levels attached: every level drawn comes from them. */
const rv = (v: CaseView) => ({ ...v.view, serverLevels: v.levelHistory });
function stageOf(v: CaseView): StageId { return (v.view.steps[v.case.step]?.stage ?? 1) as StageId; }
function stageRail(v: CaseView): string {
  const cur = stageOf(v);
  const closed = v.case.status === 'referred' || v.case.status === 'closed-assessment';
  const nx = v.next;
  return `<ol class="wf" aria-label="Case workflow">${([1, 2, 3, 4, 5, 6, 7] as StageId[])
    .map((s) => {
      const state = closed && s <= 7 && (s <= cur || v.case.status === 'referred') ? 'done' : s < cur ? 'done' : s === cur ? 'current' : 'locked';
      const why = state === 'locked' ? (s === cur + 1 && nx ? `Unlocks with: ${nx.actionLabel}` : 'Locked until the stages before it are complete') : state === 'done' ? 'Done' : 'Current stage';
      return `<li class="wf__i" data-state="${state}"${state === 'current' ? ' aria-current="step"' : ''}><span class="wf__node" aria-hidden="true"></span><span class="wf__n">${s}</span><span class="wf__name">${esc(STAGE_NAMES[s])}</span><span class="wf__why">${esc(why)}</span></li>`;
    })
    .join('')}</ol>`;
}
function caseHeader(v: CaseView): string {
  const m = v.view.meta;
  const al = alerts.find((a) => a.id === v.case.alertId);
  const row = (k: string, val: string) => `<div><dt>${k}</dt><dd>${val}</dd></div>`;
  return `<header class="chead"><p class="phead__k">Case file</p><h1 class="chead__t">${esc(v.view.title)}</h1>
    <dl class="chead__dl">
      ${row('Reference', `<span class="v">${esc(v.case.ref)}</span>`)}
      ${row('Status', `<b>${esc(STATUS[v.case.status])}</b>`)}
      ${row('Assignee', esc(userName(v.case.assignee)))}
      ${row('Opened', `<span class="v">${esc(fmtTime(v.case.openedAt))}</span>`)}
      ${row('From alert', `<span class="v">${esc(v.case.alertId)}</span>${al ? ` &middot; ${esc(al.severity)}` : ''}`)}
      ${m ? row('Originator', esc(m.originator)) + row('Tasking', esc(m.tasking)) + row('Desk', esc(m.desk)) + row('Priority', esc(m.priority)) : ''}
    </dl></header>`;
}
function pendingHTML(v: CaseView): string {
  if (!v.pending.length) return '';
  return `<ul class="pending" aria-label="Requests awaiting a return">${v.pending
    .map((r) => { const c = connector(r.source); return `<li class="pending__i" data-due="${esc(r.dueAt)}"><span class="pending__n">${esc(c?.plainName ?? sourceName(v.view, r.source))} ${ref(r.source)}</span><span class="pending__c">Returns in <span class="v" data-countdown>${countdown(r.dueAt)}</span></span><span class="pending__t">Requested by ${esc(userName(r.requestedBy))} &middot; stated turnaround ${esc(dur(c?.turnaroundMinutes ?? 60))}, compressed to seconds in the demo</span></li>`; })
    .join('')}</ul>`;
}
const countdown = (due: string) => { const s = Math.max(0, Math.ceil((Date.parse(due) - Date.now()) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function nextAction(v: CaseView): string {
  const nx = v.next;
  if (v.case.status === 'awaiting-supervisor') return signoffPanel(v);
  if (!nx) return '';
  const k = nx.trigger.kind;
  if (k === 'signoff') return signoffPanel(v);
  if (k === 'refer') return referralPanel(v);
  if (k === 'collect' || k === 'test' || k === 'hypotheses') {
    const src = 'source' in nx.trigger ? nx.trigger.source : undefined;
    const c = src ? connector(src) : undefined;
    const busy = v.pending.length > 0;
    const isAnalyst = role() === 'analyst';
    return `<section class="nextbar" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Next action</p>
      <p class="nextbar__t">${esc(nx.actionLabel)}</p>
      ${src ? `<p class="nextbar__d">${esc(c?.plainName ?? sourceName(v.view, src))} ${ref(src)} &middot; stated turnaround ${esc(dur(c?.turnaroundMinutes ?? 60))}${c?.mode !== 'live' ? ' &middot; demo connector, synthetic return' : ''}</p>` : '<p class="nextbar__d">Records the competing explanations, each with what would support or refute it.</p>'}
      <button class="btn btn--primary" type="button" data-action="${k}" data-source="${src ?? ''}"${busy || !isAnalyst ? ' disabled aria-describedby="next-why"' : ''}>${esc(nx.actionLabel)}</button>
      ${busy ? '<p class="nextbar__why" id="next-why">A request is pending. The case moves on when it returns.</p>' : !isAnalyst ? '<p class="nextbar__why" id="next-why">Only an analyst can act on a case. Switch account in the top bar.</p>' : ''}
      ${pendingHTML(v)}
    </section>`;
  }
  return '';
}

function signoffPanel(v: CaseView): string {
  const so = v.view.signoff;
  const r = role();
  if (v.case.status === 'awaiting-supervisor') {
    if (r !== 'supervisor') return `<section class="nextbar" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Sign-off</p><p class="nextbar__t">Signed by the analyst. Awaiting countersignature.</p><p class="nextbar__d">A supervisor who is a different user must check and countersign. Switch account to Supervisor 1 in the top bar.</p>${noticeHTML()}</section>`;
    const entry = so.signableEntryId ?? '';
    return `<section class="nextbar nextbar--sign" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Supervisor countersignature</p>
      <p class="nextbar__t">${ref(entry)} ${levelline(5, 18)}</p>
      <fieldset class="chooser"><legend class="chooser__legend">Checks before countersigning</legend>
        ${so.supervisorChecks.map((c) => `<label class="chooser__opt"><input class="chooser__input" type="checkbox" name="check" value="${esc(c.id)}"><span class="chooser__box"><i></i></span><span class="chooser__label">${esc(c.label)}</span><span class="chooser__code">${esc(c.id)}</span></label>`).join('')}
      </fieldset>
      <div class="actions"><button class="btn btn--primary" type="button" data-countersign="${esc(entry)}">Countersign</button></div>
      <p class="nextbar__why">An unticked check returns the case to the analyst with that check named.</p>${noticeHTML()}</section>`;
  }
  if (r !== 'analyst') return `<section class="nextbar" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Sign-off</p><p class="nextbar__t">Waiting for the analyst</p><p class="nextbar__d">The analyst signs or records an assessment first. Switch account to an analyst in the top bar.</p>${noticeHTML()}</section>`;
  const signable = so.signableEntryId;
  if (signable) {
    const reasons = so.reasonCodes.filter((c) => c.actions.includes('promote') && c.entryIds.includes(signable));
    return `<section class="nextbar nextbar--sign" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Sign-off</p>
      <p class="nextbar__t">Sign ${ref(signable)} ${levelline(5, 18)}</p>
      <p class="nextbar__d">Only a level 5 entry can be signed. Signing records a judgement; it changes no level.</p>
      <fieldset class="chooser"><legend class="chooser__legend">Reason (chosen, never typed)</legend>
        ${reasons.map((c, i) => `<label class="chooser__opt"><input class="chooser__input" type="radio" name="reason" value="${esc(c.code)}"${i === 0 ? ' checked' : ''}><span class="chooser__box"><i></i></span><span class="chooser__label">${esc(c.label)}</span><span class="chooser__code">${esc(c.code)}</span></label>`).join('')}
      </fieldset>
      <div class="actions"><button class="btn btn--primary" type="button" data-sign="${esc(signable)}" data-signaction="promote">Sign as analyst</button></div>${noticeHTML()}</section>`;
  }
  const open = so.openEntries;
  return `<section class="nextbar nextbar--sign" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Assessment, not a sign-off</p>
    <p class="nextbar__t">Nothing in this case can be signed</p>
    <p class="nextbar__d">Only a level 5 entry can be signed. Every open entry is listed with what it lacks, with equal weight.</p>
    <ul class="lacks">${open.map((o) => `<li>${ref(o.entryId)} ${o.level ? levelline(o.level as Level, 16) : ''}<span>${esc(o.lacks)}</span></li>`).join('')}</ul>
    <fieldset class="chooser"><legend class="chooser__legend">Entry</legend>${open.map((o, i) => `<label class="chooser__opt"><input class="chooser__input" type="radio" name="aentry" value="${esc(o.entryId)}"${i === 0 ? ' checked' : ''}><span class="chooser__box"><i></i></span><span class="chooser__label">${esc(o.entryId)}</span><span class="chooser__code">${o.level ? `L${o.level}` : ''}</span></label>`).join('')}</fieldset>
    <fieldset class="chooser"><legend class="chooser__legend">Reason (chosen, never typed)</legend>
      ${so.reasonCodes.filter((c) => !c.actions.includes('promote')).map((c, i) => `<label class="chooser__opt"><input class="chooser__input" type="radio" name="reason" value="${esc(c.code)}" data-act="${c.actions[0]}"${i === 0 ? ' checked' : ''}><span class="chooser__box"><i></i></span><span class="chooser__label">${esc(cap(c.actions[0] ?? ''))}: ${esc(c.label)}</span><span class="chooser__code">${esc(c.code)}</span></label>`).join('')}
    </fieldset>
    <div class="actions"><button class="btn btn--primary" type="button" data-assess>Record the assessment</button></div>${noticeHTML()}</section>`;
}
let sendLog: { recipientId: string; status: string; at: string }[] = [];
function referralPanel(v: CaseView): string {
  const rec = [...v.view.recipients].sort((a, b) => a.order - b.order);
  // The analyst who signed the finding disseminates it; nobody else can.
  const mine = role() === 'analyst' && currentUser() === v.signedBy;
  const sent = new Set(sendLog.map((s) => s.recipientId));
  return `<section class="nextbar nextbar--refer" aria-labelledby="next-h"><p class="nextbar__k" id="next-h">Dissemination</p>
    <p class="nextbar__t">${sendLog.length ? 'Referral sent up the chain' : 'Disseminate the referral'}</p>
    <ol class="chain" aria-label="Recipient roles, in order">${rec.map((r) => `<li class="chain__i${sent.has(r.id) ? ' is-sent' : ''}"><span class="chain__n">${r.order}</span><span class="chain__t">${esc(r.title)} <span class="chain__l">${esc(r.label === '(fictional)' ? '(simulated role)' : r.label)}</span></span><span class="chain__s">${sent.has(r.id) ? 'Delivered in the app' : 'Not sent'}</span></li>`).join('')}</ol>
    ${sendLog.length ? `<div class="tbl" role="region" aria-labelledby="sendlog-cap" tabindex="0"><table class="tbl__t"><caption class="tbl__cap" id="sendlog-cap">Send log</caption><thead><tr><th scope="col">Time</th><th scope="col">Recipient role</th><th scope="col">Status</th></tr></thead><tbody>${sendLog.map((s) => `<tr><td class="tbl__num"><span class="v">${esc(fmtTime(s.at))}</span></td><td>${esc(rec.find((r) => r.id === s.recipientId)?.title ?? s.recipientId)}</td><td>${esc(s.status)}</td></tr>`).join('')}</tbody></table></div>
      <div class="actions"><button class="btn" type="button" data-packet>Download the packet</button></div>` : `<div class="actions"><button class="btn btn--primary" type="button" data-refer${!mine ? ' disabled aria-describedby="refer-why"' : ''}>Disseminate the referral</button></div>${!mine ? `<p class="nextbar__why" id="refer-why">Only the analyst who signed this finding sends its referral${v.signedBy ? `: ${esc(userName(v.signedBy))}` : ''}. Switch account in the top bar.</p>` : ''}`}
    <p class="nextbar__d">Delivery happens inside this application only. Nothing is sent to any real person, authority or system.</p>${noticeHTML()}</section>`;
}
const noticeHTML = () => (notice ? `<p class="refusal" id="refusal">${esc(notice)}${chainBroken ? ' <button class="btn btn--small" type="button" data-newws>Start a new demo workspace</button>' : ''}</p>` : '');

function outcomeHTML(v: CaseView): string {
  if (v.case.status !== 'referred' && v.case.status !== 'closed-assessment') return '';
  const a = v.view.assessment;
  return `<section class="outcome" aria-labelledby="out-h"><p class="nextbar__k">Outcome</p><h2 class="outcome__t" id="out-h">${v.case.status === 'referred' ? 'Signed, countersigned and referred' : 'Closed with an assessment record, no referral'}</h2>
    ${a?.captions.length ? assessmentHTML(rv(v), v.case.step) : '<p class="note">The closing assessment is released with the final stage.</p>'}
    </section>${v.case.status === 'referred' ? referralPanel(v) : ''}`;
}

function renderCaseMain(v: CaseView) {
  const steps = [...v.view.steps].reverse();
  const stage = stageOf(v);
  main.innerHTML = `${caseHeader(v)}
    <div class="ctabs" role="tablist" aria-label="Case views">
      <button class="ctabs__b" role="tab" type="button" id="tab-wf" aria-controls="tp-wf" aria-selected="${caseTab === 'workflow'}" tabindex="${caseTab === 'workflow' ? 0 : -1}" data-tab="workflow">Workflow</button>
      <button class="ctabs__b" role="tab" type="button" id="tab-au" aria-controls="tp-au" aria-selected="${caseTab === 'audit'}" tabindex="${caseTab === 'audit' ? 0 : -1}" data-tab="audit">Audit trail</button>
    </div>
    <div class="tp" role="tabpanel" id="tp-wf" aria-labelledby="tab-wf"${caseTab === 'workflow' ? '' : ' hidden'}>
      ${stageRail(v)}
      <p class="stagelede"><span class="stagelede__k">Stage ${stage}, ${esc(STAGE_NAMES[stage])}.</span> ${esc(STAGE_LEDES[stage] ?? '')}</p>
      ${nextAction(v)}
      ${outcomeHTML(v)}
      <section class="caselog" aria-labelledby="log-h"><h2 class="block__h" id="log-h">Case log, newest first</h2>
        ${steps.map((s, i) => stepHTML(rv(v), s, i === 0, `s${s.index}`)).join('')}
      </section>
    </div>
    <div class="tp" role="tabpanel" id="tp-au" aria-labelledby="tab-au"${caseTab === 'audit' ? '' : ' hidden'}><div id="audit-body"><p class="note">Loading the audit trail.</p></div></div>`;
  if (caseTab === 'audit') void loadAudit(v.case.ref);
}

function renderRegister(m: Model, step: number) {
  const k = registerCounts(m, step);
  side.setAttribute('aria-label', 'Evidence register');
  const gapsBtn = k.gaps ? `<button class="gapjump" type="button" data-gaps>${lacuna(undefined, 'paper', 30, 18)}<span><b>${k.gaps}</b> collection ${k.gaps === 1 ? 'gap' : 'gaps'}: expected, not observed</span></button>`
    : `<p class="gapjump gapjump--none">${lacuna(undefined, 'paper', 30, 18)}<span><b>0</b> collection gaps so far</span></p>`;
  side.innerHTML = `<div class="register-sheet on-paper" id="regsheet">
    <button class="regbar" type="button" aria-expanded="false" aria-controls="regbody" data-regbar><span class="regbar__t">Evidence register</span><span class="regbar__c">${k.total} entries</span><span class="regbar__g">${lacuna(undefined, 'paper', 26, 16)} <b>${k.gaps}</b> gaps</span></button>
    <div class="regsheet__in" id="regbody">
      <header class="catalogue__head"><h2 class="catalogue__title">Evidence register</h2><button class="regclose" type="button" data-regclose>Close</button>
        <p class="catalogue__total">${k.total} entries &middot; case <span class="v">${esc(openRef ?? '')}</span></p>${tallyHTML(m, step)}${gapsBtn}</header>
      <div class="catalogue__body" id="regscroll">${registerHTML(m, step, 'rg')}</div>
    </div></div>`;
}

// ---- refresh and diff --------------------------------------------------------------------------------------------
interface Snap { step: number; levels: Map<string, string> }
const snapOf = (m: Model, step: number): Snap => ({ step, levels: new Map(m.entries.map((e) => { const s = entryStatus(e, step); return [e.id, s.kind === 'current' ? `L${s.level}` : s.kind]; })) });
let lastSnap: Snap | null = null;

async function showCase(ref: string, how: 'open' | 'nav' | 'poll') {
  let v: CaseView;
  try { v = await api.caseView(ref); } catch (e) { main.innerHTML = `<p class="refusal">${esc(e instanceof ApiError ? e.message : 'The case could not be loaded.')}</p>`; return; }
  const m = buildModel(v.view, v.levels, v.levelHistory);
  const reg = v.view.map.region ? v.view.map.shapes.find((s) => s.id === v.view.map.region!.shapeId) : undefined;
  if (reg) map.addRegion(reg);
  const prevStep = cv && cv.case.ref === ref ? cv.case.step : null;
  const prevStatus = cv && cv.case.ref === ref ? cv.case.status : null;
  const changed = prevStep === null || prevStep !== v.case.step || prevStatus !== v.case.status || JSON.stringify(cv?.pending.map((p) => p.id)) !== JSON.stringify(v.pending.map((p) => p.id));
  if (how === 'poll' && !changed) { tickCountdowns(); return; }
  const regScroll = $('regscroll')?.scrollTop ?? 0;
  const flipState = prevStep !== null && prevStep < v.case.step && !reduce() ? Flip.getState(side.querySelectorAll('[data-flip-id]')) : null;
  const openDetails = new Set([...main.querySelectorAll<HTMLDetailsElement>('details[open][data-step]')].map((d) => d.dataset.step));
  const sealNow = v.view.map.shapes.some((x) => x.kind === 'seal');
  const sealBefore = cv && cv.case.ref === ref ? cv.view.map.shapes.some((x) => x.kind === 'seal') : sealNow;
  cv = v;
  model = m;
  if (v.case.status === 'referred') { try { sendLog = (await api.referralLog(ref)) as typeof sendLog; } catch { sendLog = []; } } else if (v.next?.trigger.kind === 'refer') { try { sendLog = (await api.referralLog(ref)) as typeof sendLog; } catch { sendLog = []; } } else sendLog = [];
  shell.dataset.mode = 'case';
  renderCaseMain(v);
  if (prevStep !== null && prevStep !== v.case.step) openDetails.clear();
  openDetails.forEach((s) => main.querySelector<HTMLDetailsElement>(`details[data-step="${s}"]`)?.setAttribute('open', ''));
  renderRegister(m, v.case.step);
  const sc = $('regscroll'); if (sc) sc.scrollTop = regScroll;

  // The map: a descent when the case is first shown; a tween of what changed after that.
  if (how === 'open' || prevStep === null) {
    map.openCase(m, v.case.step, how === 'open');
    renderAreas();
    if (how === 'open') announce(`Case ${v.case.ref} opened from alert ${v.case.alertId}. Now viewing: case plate, local grid.`);
    else announce(`Case ${v.case.ref}, stage ${stageOf(v)} of 7, ${STAGE_NAMES[stageOf(v)]}.`);
    lastSnap = snapOf(m, v.case.step);
    return;
  }
  if (prevStep === v.case.step) {
    lastSnap = snapOf(m, v.case.step);
    // The seal is released by the countersignature, and withdrawn if a later promotion has not been countersigned.
    if (sealNow !== sealBefore) { map.caseStep(m, v.case.step, true); announce(sealNow ? 'Seal applied: the supervisor countersigned, and the area is sealed under sign-off.' : 'Seal withdrawn: the promotion is not countersigned.'); }
    renderAreas();
    if (prevStatus !== v.case.status && sealNow === sealBefore) announce(`Case status: ${STATUS[v.case.status]}.`);
    return;
  }
  // A release landed: name each change, animate only what changed.
  const released = v.view.steps.filter((s) => s.index > prevStep && s.index <= v.case.step);
  const msgs = released.flatMap((s) => s.changes.filter((c) => c.type === 'stage' || c.type === 'level-rise' || c.type === 'level-fall' || c.type === 'map').map((c) => c.announce));
  announce(msgs.join(' ') || `Step released: ${released.map((s) => s.title).join(', ')}.`);
  map.caseStep(m, v.case.step, true);
  renderAreas();
  if (reduce()) { lastSnap = snapOf(m, v.case.step); return; }
  const before = lastSnap;
  const after = snapOf(m, v.case.step);
  lastSnap = after;
  const risen = [...after.levels].filter(([id, l]) => before?.levels.get(id) !== l).map(([id]) => id);
  if (flipState) {
    const targets = risen.map((id) => side.querySelector(`[data-flip-id="${CSS.escape(id)}"]`)).filter((e): e is Element => !!e);
    targets.forEach((t) => t.classList.add('is-new'));
    Flip.from(flipState, { targets, duration: DURATION.standard, ease: EASE.settle, absolute: true, onComplete: () => targets.forEach((t) => t.classList.remove('is-new')) });
  }
  // Marks gain their new strokes; level lines settle in weight; the stage title is set.
  const newest = main.querySelector(`details[data-step="${v.case.step}"]`);
  for (const s of released) for (const c of s.changes) {
    if (c.type !== 'level-rise') continue;
    const slip = newest?.querySelector(`.claim[data-claim="${CSS.escape(c.entryId)}"][data-level="${c.to}"]`);
    const strokes = slip ? [...slip.querySelectorAll<SVGPathElement>('.mk path')].filter((p) => STROKES_BY_LEVEL[c.to as Level].includes(p.dataset.stroke ?? '')) : [];
    strokes.forEach((p) => { const len = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: DURATION.standard, ease: EASE.settle, clearProps: 'strokeDasharray,strokeDashoffset' }); });
    const txt = slip?.querySelector('.claim__text');
    if (txt) gsap.fromTo(txt, { '--wt': 300 }, { '--wt': 440, duration: DURATION.standard, ease: EASE.settle, clearProps: '--wt' });
  }
  const wf = main.querySelector('.wf__i[data-state="current"] .wf__name');
  if (released.some((s) => s.changes.some((c) => c.type === 'stage')) && wf) gsap.fromTo(wf, { fontWeight: 300 }, { fontWeight: 600, duration: DURATION.long, ease: EASE.settle, clearProps: 'fontWeight' });
  // The verified moment: outside evidence arrives from outside the frame, the frame is inked, rivals dissolve.
  const verified = released.flatMap((s) => s.changes).find((c) => c.type === 'level-rise' && c.to === 5);
  if (verified && verified.type === 'level-rise') {
    const fallen = released.flatMap((s) => s.changes).filter((c) => c.type === 'level-fall').map((c) => (c.type === 'level-fall' ? c.entryId : ''));
    const fp = (id: string) => v.view.hypotheses.find((h) => h.id === id)?.footprintShapeId;
    map.test(fp(verified.entryId), fallen.map(fp).filter((x): x is string => !!x));
    const outside = newest?.querySelector('.exhibit--outside');
    if (outside) gsap.from(outside, { x: () => window.innerWidth, duration: DURATION.long, ease: EASE.travel });
    const ink = newest?.querySelector('.card--l5 .card__ink');
    if (ink) gsap.fromTo(ink, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: DURATION.long, ease: EASE.draw, delay: 0.4, clearProps: 'clipPath' });
    const line = newest?.querySelector('.card__signoff-line');
    if (line) gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, transformOrigin: '0 50%', duration: DURATION.standard, ease: EASE.settle, delay: 1.1, clearProps: 'transform' });
  }
}
function tickCountdowns() {
  main.querySelectorAll<HTMLElement>('[data-due]').forEach((li) => { const s = li.querySelector('[data-countdown]'); if (s) s.textContent = countdown(li.dataset.due!); });
}

/** The audit tab prints only the detail fields named here, in plain words. Any other key is never shown. */
const DETAIL_LABELS: Record<string, string> = { alertId: 'Alert', ruleId: 'Rule', reasonCode: 'Reason', entryId: 'Entry', step: 'Step', stage: 'Stage', source: 'Source', requestId: 'Request', status: 'Result', from: 'From', to: 'To', speed: 'Speed', result: 'Result', outcome: 'Outcome', kind: 'Kind', action: 'Action', level: 'Level', analyst: 'Signed by', checks: 'Checks', recipients: 'Recipients', dueAt: 'Due', turnaroundMinutes: 'Turnaround in minutes', trigger: 'Released by', cursor: 'Feed time' };
async function loadAudit(ref: string) {
  const out = $('audit-body');
  try {
    const [evs, ver] = await Promise.all([api.audit(ref), api.verify()]);
    out.innerHTML = `<p class="verify verify--${ver.ok ? 'ok' : 'bad'}">${ver.ok ? `Chain verified: ${num(ver.length)} events. Every hash matches its predecessor, every event carries this install's signature, and the head record agrees with the log.` : `Chain broken${ver.brokenAt ? ` at event ${ver.brokenAt}` : ''}: ${esc(ver.reason ?? 'the log fails verification')}. Nothing more can be recorded until it is investigated.`}</p>
      <div class="tbl" role="region" aria-labelledby="audit-cap" tabindex="0"><table class="tbl__t tbl__t--audit"><caption class="tbl__cap" id="audit-cap">Audit events for case ${esc(ref)}, oldest first</caption>
      <thead><tr><th scope="col" class="tbl__num">Seq</th><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Detail</th><th scope="col">Hash</th></tr></thead>
      <tbody>${evs.map((e) => `<tr><td class="tbl__num"><span class="v">${e.seq}</span></td><td><span class="v">${esc(fmtTime(e.at))}</span></td><td>${esc(e.actor === 'system' ? 'Platform' : userName(e.actor))}<span class="tbl__sub">${esc(e.role)}</span></td><td>${esc(e.action.replace(/-/g, ' '))}</td><td>${Object.entries(e.detail).filter(([k]) => k in DETAIL_LABELS).map(([k, val]) => `${esc(DETAIL_LABELS[k] as string)} <span class="v">${esc(String(val))}</span>`).join(', ')}</td><td><span class="v" title="${esc(e.hash)}">${esc(e.hash.slice(0, 10))}</span><span class="tbl__sub">after <span class="v">${esc(e.prevHash.slice(0, 10))}</span></span></td></tr>`).join('')}</tbody></table></div>`;
  } catch (e) { out.innerHTML = `<p class="refusal">${esc(e instanceof ApiError ? e.message : 'The audit trail could not be loaded.')}</p>`; }
}

function renderAreas() {
  const items = map.areaItems();
  $('areas-list').innerHTML = items.length ? items.map((a) => `<li><button class="areas__b" type="button" data-area="${esc(a.id)}">${esc(a.name)} <span class="ref">${esc(a.entryId)}</span><span class="areas__l">${esc(a.level)}</span></button></li>`).join('') : '<li class="areas__none">No area on this plate yet</li>';
}
let panelReturn: HTMLElement | null = null;
map.onSelect = (it) => {
  const p = $('mappanel');
  if (!it) { p.hidden = true; return; }
  p.hidden = false;
  p.innerHTML = `<header class="mappanel__h"><h3 id="mappanel-h" tabindex="-1">${esc(it.name)}</h3><button class="mappanel__x" type="button" data-closepanel>Close</button></header>
    <dl class="mappanel__dl"><div><dt>Bound to</dt><dd>${ref(it.entryId)} ${esc(it.level)}</dd></div><div><dt>Label</dt><dd>${esc(it.label)}</dd></div><div><dt>Derivation</dt><dd>${esc(it.derivation)}</dd></div>${it.evidence ? `<div><dt>Evidence</dt><dd><span class="v v--wrap">${esc(it.evidence)}</span></dd></div>` : ''}</dl>`;
  p.querySelector<HTMLElement>('h3')?.focus();
};

// ---- events ------------------------------------------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const t = e.target as HTMLElement;
  const b = t.closest<HTMLElement>('button, [data-feed]');
  if (!b) return;
  try {
    if (b.dataset.feed === 'start') { await api.feedStart(speed || speeds(feed)[0]![0]); announce('Feed started.'); await pollMonitor(); }
    else if (b.dataset.feed === 'pause') { await api.feedPause(); announce('Feed paused.'); await pollMonitor(); }
    else if (b.dataset.feed === 'reset') {
      if (!resetArmed) { resetArmed = true; renderMonitorMain(); main.querySelector<HTMLButtonElement>('[data-feed="reset"]')?.focus(); return; }
      resetArmed = false;
      await api.reset();
      cases = []; alerts = []; cv = null; openRef = null; location.hash = '#monitor';
      announce('Demo workspace reset.');
      await pollMonitor();
    } else if (b.dataset.open) {
      const row = await api.openCase(b.dataset.open);
      openRef = row.ref;
      cases = await api.cases();
      history.pushState(null, '', `#case/${encodeURIComponent(row.ref)}`);
      renderTabs();
      await showCase(row.ref, 'open');
      main.focus();
    } else if (b.dataset.dismiss) { await api.dismiss(b.dataset.dismiss, b.dataset.reason!); announce('Alert dismissed with a prepared reason.'); await pollMonitor(); }
    else if (b.dataset.action && cv) {
      notice = '';
      await api.action(cv.case.ref, b.dataset.action as 'collect', (b.dataset.source || undefined) as SourceCode | undefined);
      announce(`${b.textContent?.trim()}: requested.`);
      await showCase(cv.case.ref, 'poll');
    } else if (b.dataset.sign && cv) {
      const reason = main.querySelector<HTMLInputElement>('input[name="reason"]:checked')?.value ?? '';
      await submit(() => api.signoff(cv!.case.ref, b.dataset.sign!, 'promote', reason), 'Signed as analyst. Awaiting a supervisor countersignature.');
    } else if (b.dataset.assess !== undefined && cv) {
      const r = main.querySelector<HTMLInputElement>('input[name="reason"]:checked');
      const entry = main.querySelector<HTMLInputElement>('input[name="aentry"]:checked')?.value ?? '';
      await submit(() => api.signoff(cv!.case.ref, entry, (r?.dataset.act ?? 'hold') as 'hold', r?.value ?? ''), 'Assessment recorded. It is not a sign-off and produces no referral.');
    } else if (b.dataset.countersign && cv) {
      const checks = [...main.querySelectorAll<HTMLInputElement>('input[name="check"]')].map((i) => ({ id: i.value, passed: i.checked }));
      await submit(() => api.supervisor(cv!.case.ref, b.dataset.countersign!, checks), checks.every((c) => c.passed) ? 'Countersigned by the supervisor.' : 'Returned to the analyst: a check did not pass.');
    } else if (b.dataset.refer !== undefined && cv) {
      await submit(() => api.referral(cv!.case.ref, cv!.view.signoff.signableEntryId ?? undefined), 'Referral disseminated to four simulated roles, in the app only.');
    } else if (b.dataset.packet !== undefined && cv) {
      const blob = await api.packet(cv.case.ref);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `SIMULATED-referral-${cv.case.ref.replace(/\W+/g, '-')}.html`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      announce('Packet downloaded.');
    } else if (b.dataset.tab && cv) { caseTab = b.dataset.tab as 'workflow'; renderCaseMain(cv); main.querySelector<HTMLElement>(`[data-tab="${caseTab}"]`)?.focus(); }
    else if (b.dataset.zoom) { b.dataset.zoom === 'in' ? map.zoom(1.25) : b.dataset.zoom === 'out' ? map.zoom(0.8) : map.resetView(); }
    else if (b.dataset.area) { panelReturn = b; map.select(b.dataset.area); }
    else if (b.dataset.closepanel !== undefined) { $('mappanel').hidden = true; (panelReturn ?? $('map')).focus(); }
    else if (b.dataset.gaps !== undefined) { openSheet(true); const first = side.querySelector<HTMLElement>('#rg-gaps .entry__link'); first?.scrollIntoView({ block: 'nearest' }); first?.focus(); }
    else if (b.dataset.regbar !== undefined) openSheet(true);
    else if (b.dataset.regclose !== undefined) openSheet(false);
    else if (b.dataset.showRecords !== undefined) await showRecords(b);
    else if (b.dataset.newws !== undefined) { newWorkspace(); location.reload(); }
    else if (b.dataset.baseline) {
      const r = await api.baseline(b.dataset.baseline);
      const out = document.querySelector<HTMLElement>(`[data-baseline-out="${CSS.escape(b.dataset.baseline)}"]`);
      if (out) out.innerHTML = ` ${num(r.population.count)} records; first ${r.recordIds.length}: ${r.recordIds.map((i) => `<span class="v">${esc(i)}</span>`).join(', ')}. Digest <span class="v">${esc(r.population.sha256.slice(0, 16))}</span>.`;
      b.remove();
    }
  } catch (err) {
    const msg = err instanceof ApiError ? err.message : 'The request did not complete.';
    if (err instanceof ApiError && err.refusal.code === 'audit-chain-broken') chainBroken = true;
    notice = msg;
    announce(`Refused: ${msg}`);
    if (cv && shell.dataset.mode === 'case') renderCaseMain(cv); else main.insertAdjacentHTML('afterbegin', `<p class="refusal">${esc(msg)}</p>${chainBroken ? brokenHTML() : ''}`);
  }
});
async function submit(fn: () => Promise<unknown>, ok: string) {
  notice = '';
  await fn();
  announce(ok);
  await showCase(cv!.case.ref, 'poll');
}
document.addEventListener('change', (e) => {
  const t = e.target as HTMLSelectElement;
  if (t.dataset.feed === 'speed') {
    speed = Number(t.value);
    // A running feed takes the new speed at once; the platform writes it to the audit trail.
    if (feed?.state === 'running') void api.feedStart(speed).then(() => { announce('Replay speed changed.'); return pollMonitor(); }).catch((err) => announce(`Refused: ${err instanceof ApiError ? err.message : 'the speed was not changed.'}`));
  }
});
document.addEventListener('focusin', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-alert]');
  if (li && shell.dataset.mode === 'monitor') setFocusAlert(li);
});
document.addEventListener('mouseover', (e) => {
  const li = (e.target as HTMLElement).closest<HTMLElement>('[data-alert]');
  if (li && shell.dataset.mode === 'monitor') setFocusAlert(li);
});
function setFocusAlert(li: HTMLElement) {
  const r = li.dataset.region || null;
  if (r === focusAlert) return;
  focusAlert = r;
  map.monitor(r, true);
}
$('map').addEventListener('keydown', (e) => { if (map.key(e)) e.preventDefault(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('mappanel').hidden) { $('mappanel').hidden = true; (panelReturn ?? $('map')).focus(); }
    else if (side.querySelector('.register-sheet.is-open')) openSheet(false);
  }
  const tab = (e.target as HTMLElement).closest('[role="tab"]');
  if (tab && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && cv) { caseTab = caseTab === 'workflow' ? 'audit' : 'workflow'; renderCaseMain(cv); main.querySelector<HTMLElement>(`[data-tab="${caseTab}"]`)?.focus(); }
  const sheet = side.querySelector('.register-sheet.is-open');
  if (sheet && e.key === 'Tab') {
    const f = [...sheet.querySelectorAll<HTMLElement>('button, summary, [tabindex="0"]')].filter((x) => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1]!.focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0]!.focus(); }
  }
});

// Narrow screens: the register is a bottom bar that opens to a modal sheet; focus moves in, Escape returns it.
function openSheet(open: boolean) {
  const sheet = side.querySelector<HTMLElement>('.register-sheet');
  if (!sheet) return;
  const bar = sheet.querySelector<HTMLButtonElement>('[data-regbar]')!;
  // Modal only where the bar exists (narrow screens); while open the bar is hidden, so closing checks the open state.
  if (open ? getComputedStyle(bar).display === 'none' : !sheet.classList.contains('is-open')) return;
  sheet.classList.toggle('is-open', open);
  bar.setAttribute('aria-expanded', String(open));
  const body = sheet.querySelector<HTMLElement>('.regsheet__in')!;
  for (const el of [document.querySelector('.topbar'), main, $('map').parentElement, document.querySelector('.foot')]) (el as HTMLElement | null)?.toggleAttribute('inert', open);
  if (open) { body.setAttribute('role', 'dialog'); body.setAttribute('aria-modal', 'true'); body.setAttribute('aria-label', 'Evidence register'); sheet.querySelector<HTMLElement>('[data-regclose]')?.focus(); }
  else { body.removeAttribute('role'); body.removeAttribute('aria-modal'); body.removeAttribute('aria-label'); bar.focus(); }
}

async function showRecords(b: HTMLElement) {
  const box = b.closest<HTMLElement>('.recs')!;
  const out = box.querySelector<HTMLElement>('.recs__out')!;
  if (!cv) return;
  out.innerHTML = '<p class="note">Loading records.</p>';
  try {
    const r = await api.records(cv.case.ref, { entry: box.dataset.recordsEntry, level: Number(box.dataset.recordsLevel), offset: 0, limit: 20 });
    const items = (r.evidenceItems ?? []) as { id: string; title: string; summary: string }[];
    out.innerHTML = (r.records.length ? recordsTable(cv.view, r.records, `First ${r.records.length} of ${num(r.total)} records behind ${box.dataset.recordsEntry} at level ${box.dataset.recordsLevel}`, `rt-${box.dataset.recordsEntry}-${box.dataset.recordsLevel}`) : '')
      + items.map((i) => `<p class="note"><span class="ref">${esc(i.id)}</span> ${esc(i.title)}: ${esc(i.summary)}</p>`).join('');
    b.remove();
  } catch (e) {
    out.innerHTML = `<p class="refusal">${esc(e instanceof ApiError ? e.message : 'The records could not be loaded.')}</p>`;
  }
}

// ---- routing and polling -----------------------------------------------------------------------------------------
async function pollMonitor() {
  try {
    const [f, al] = await Promise.all([api.feedStatus(), api.alerts()]);
    const fresh = al.filter((a) => !alerts.some((x) => x.id === a.id));
    feed = f; alerts = al;
    renderClock();
    if (shell.dataset.mode === 'monitor') {
      const active = document.activeElement?.closest('[data-alert], .feed') ? (document.activeElement as HTMLElement) : null;
      const activeKey = active?.dataset.open ?? active?.dataset.feed ?? null;
      renderMonitorMain();
      if (fresh.length || !side.querySelector('.queue') || al.some((a, i) => alerts[i]?.status !== a.status)) renderQueue();
      else renderQueue();
      if (activeKey) document.querySelector<HTMLElement>(`[data-open="${activeKey}"], [data-feed="${activeKey}"]`)?.focus();
      // The national plate draws each queued alert's region as an area of stated uncertainty; the light goes to the newest alert's region unless one is hovered or focused.
      const queued = al.filter((a) => a.status === 'new' && a.region);
      const drawn = new Set(map.drawnRegions());
      const arrived = queued.filter((a) => !drawn.has(a.region!.shapeId) && fresh.includes(a));
      for (const a of queued) map.addRegion(regionShape(a)!);
      map.setAlertRegions(queued.map((a) => ({ shapeId: a.region!.shapeId, alertId: a.id })));
      const newest = [...queued].sort((a, b) => (a.detection.at < b.detection.at ? 1 : -1))[0];
      if (fresh.some((a) => a.region)) focusAlert = null;
      map.monitor(focusAlert ?? newest?.region?.shapeId ?? null, fresh.length > 0);
      if (fresh.length) {
        const seen = new Set<string>();
        const drawnMsg = arrived.filter((a) => !seen.has(a.region!.shapeId) && seen.add(a.region!.shapeId)).map((a) => { const n = regionOf(a.region!); return `Alert ${a.id}: ${n.charAt(0).toLowerCase()}${n.slice(1)} drawn on the national plate.`; });
        announce([`New alert: ${fresh.map((a) => `${a.severity}, ${a.title}`).join('; ')}.`, ...drawnMsg].join(' '));
      }
      renderAreas();
    }
  } catch (e) {
    if (shell.dataset.mode === 'monitor') main.innerHTML = `<p class="refusal">${esc(e instanceof ApiError ? e.message : 'The platform service did not answer.')}</p>`;
  }
}
async function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  $('mappanel').hidden = true;
  if (h.startsWith('case/')) {
    const ref = h.slice(5);
    if (ref !== openRef) { cv = null; lastSnap = null; caseTab = 'workflow'; }
    openRef = ref;
    renderTabs();
    await showCase(ref, cv ? 'poll' : 'nav');
  } else {
    openRef = null; cv = null; model = null; lastSnap = null;
    shell.dataset.mode = 'monitor';
    renderTabs();
    await pollMonitor();
    renderQueue();
  }
}
window.addEventListener('hashchange', () => void route());
window.addEventListener('popstate', () => void route());

async function refresh(full: boolean) {
  if (shell.dataset.mode === 'case' && openRef) await showCase(openRef, full ? 'nav' : 'poll').then(() => { if (cv) renderCaseMain(cv); });
  else await pollMonitor();
}

let tick = 0;
async function loop() {
  tick++;
  try {
    if (shell.dataset.mode === 'monitor') { if (feed?.state === 'running' || tick % 5 === 0) await pollMonitor(); }
    else if (openRef && cv) {
      tickCountdowns();
      if (cv.pending.length || tick % 4 === 0) await showCase(openRef, 'poll');
      if (feed?.state === 'running' || tick % 5 === 0) { feed = await api.feedStatus(); renderClock(); }
    }
  } finally { setTimeout(loop, 1000); }
}

async function init() {
  if (!currentUser()) setUser('analyst-1');
  try {
    session = await api.session();
    feed = session.workspace.feed;
  } catch (e) {
    main.innerHTML = `<p class="refusal">${esc(e instanceof ApiError ? e.message : 'The platform service did not answer.')}</p>`;
  }
  if (session && !session.users.some((u) => u.id === currentUser())) setUser(session.users[0]?.id ?? 'analyst-1');
  renderAccount();
  for (const r of session?.detectionRules ?? []) ruleNames.set(r.id, r.name);
  map.mount([]);
  try { cases = await api.cases(); } catch { cases = []; }
  await route();
  void loop();
}
void init();
