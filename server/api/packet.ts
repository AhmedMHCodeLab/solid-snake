// The referral packet: an intelligence product built from the released case, its assessed levels, the two signatures
// and the recipient roles. A pure function. Only the fields read below can enter the document; everything is escaped.
import type { Assessment, CaseMeta, ClaimVersion, Entry, HypothesisVersion, Level, RecipientId, RecipientRole, SourceCode } from '../../shared/types';
import { LEVEL_NAMES } from '../../shared/types';
import type { ReleasedView } from '../engine/release';

export const ABOUT = 'A telecom fraud intelligence platform built from published research. This demo runs on synthetic data and is not connected to any operator. Not yet reviewed by telecom practitioners.';
export const HANDLING = 'SIMULATED // EXERCISE DATA';
export const ROLE_MARK = '(simulated role)';
export const CLOSING = 'Referred for consideration. Disseminated inside the platform only. Nothing was sent to any real person, authority or system.';
const RECIPIENT_IDS: readonly RecipientId[] = ['unit-lead', 'agency-head', 'regulator-desk', 'law-enforcement-desk'];

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ALLOWED_CAPS = /^(ASSUMPTION|FICTION|RESEARCH|PRACTICE|FACT|PROPOSAL|SIM(s|-box)?|IBCF|IMS|E[1-7]|R-\d+|I-\d+)$/;

/**
 * Notes cite papers, organisations and repository files. The packet keeps only the sentences that state what is
 * assumed: it drops parentheticals, and any sentence with a digit, a file name, "et al", or a capitalised word
 * that is not on the small list of basis labels.
 */
export function plainNote(note: string): string {
  const stripped = note.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ');
  return stripped
    .split(/(?<=[.;])\s+/)
    .map((s) => s.trim())
    .filter((s) => {
      if (/\d|\.md\b|\bet al\b/.test(s)) return false;
      return s.split(/[\s,:]+/).filter(Boolean).every((w, i) => {
        const bare = w.replace(/[.;]+$/, '');
        if (/^[A-Z]{2,}$/.test(bare) || (i > 0 && /^[A-Z]/.test(bare))) return ALLOWED_CAPS.test(bare);
        return true;
      });
    })
    .map((s) => s.replace(/^(ASSUMPTION|FICTION)[:.]\s*/, '').replace(/\s+([.;])/g, '$1').replace(/;$/, '.'))
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export interface Signer {
  displayName: string;
  role: string;
  action: string;
  reason: string;
  at: string;
}

export interface PacketInput {
  view: ReleasedView;
  /** The assessment of the case file, written into the packet once the gate has passed. */
  assessment: Assessment;
  levels: Map<string, Level | null>;
  caseRef: string;
  meta: CaseMeta | undefined;
  /** What raised the case: the alert title and the rule that fired. */
  raisedBy: { alertId: string; title: string; ruleId: string; at: string };
  analyst: Signer;
  supervisor: Signer;
  recipients: RecipientRole[];
}

const levelText = (l: Level | null): string => (l === null ? 'No level: the explanation fell on the evidence' : `Level ${l}, ${LEVEL_NAMES[l]}`);

/** Level 2 and 3 statements carry numeric baselines in the case data, so the packet words them from templated parts. */
function claimStatement(v: ReleasedView, cv: ClaimVersion): string {
  if (cv.level === 1) return cv.statement;
  const parts: string[] = [];
  for (const id of cv.evidenceIds) {
    const ind = v.indicators.find((x) => x.id === id);
    if (ind) parts.push(`${ind.description} is ${ind.position} its stated baseline.`);
    const ev = v.evidenceItems.find((x) => x.id === id);
    if (ev) parts.push(`Evidence item: ${ev.title}.`);
  }
  if (cv.level === 3) {
    const ind = v.independence.find((x) => x.id === cv.independenceId);
    if (ind) parts.push(ind.statement);
    parts.push('This does not make the explanation unique.');
  } else parts.push('This is an ordering, not a probability.');
  return parts.join(' ');
}

const stamp = '<span class="stamp">SIMULATED</span>';
const section = (title: string, body: string): string => `<section>\n<h2>${stamp} ${esc(title)}</h2>\n${body}\n</section>`;
const list = (items: string[]): string => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p class="none">None.</p>');

export function buildPacket(p: PacketInput): string {
  const v = p.view;
  for (const r of p.recipients) if (r.basis !== 'FICTION' || !RECIPIENT_IDS.includes(r.id)) throw new Error('recipient outside the simulated role registry');
  const sourceName = (code: SourceCode): string => {
    const s = v.sources.find((x) => x.code === code);
    return `${esc(s?.plainName ?? s?.name ?? code)} (${esc(code)})`;
  };
  const entries: Entry[] = [...v.claims, ...v.hypotheses];
  const entryTitle = (id: string): string => {
    const e = entries.find((x) => x.id === id);
    return e ? (e.kind === 'evidence' ? e.subject : e.name) : id;
  };

  const head = `<table class="head"><tbody>
<tr><th>Case reference</th><td class="id">${esc(p.caseRef)}</td></tr>
<tr><th>Originator</th><td>${esc(p.meta?.originator ?? 'Platform detection')}. Raised by alert <span class="id">${esc(p.raisedBy.alertId)}</span>, rule <span class="id">${esc(p.raisedBy.ruleId)}</span>, at ${esc(p.raisedBy.at)} feed time.</td></tr>
<tr><th>Tasking</th><td>${esc(p.meta?.tasking ?? p.raisedBy.title)}</td></tr>
<tr><th>Desk</th><td>${esc(p.meta?.desk ?? 'Not stated')}</td></tr>
<tr><th>Priority</th><td>${esc(p.meta?.priority ?? 'Not stated')}</td></tr>
</tbody></table>`;

  const judgements = list(
    p.assessment.captions.map((k) => `${esc(k.text)} <span class="meta">${k.entryIds.map((id) => `${esc(entryTitle(id))}: ${esc(levelText(p.levels.get(id) ?? null))} <span class="id">${esc(id)}</span>`).join('; ')}</span>`),
  );

  const evidence = entries
    .map((e) => {
      const level = p.levels.get(e.id) ?? null;
      const last = e.versions[e.versions.length - 1] as ClaimVersion | HypothesisVersion;
      const statement = e.kind === 'evidence' ? claimStatement(v, last as ClaimVersion) : last.statement;
      const codes = new Set<SourceCode>();
      if (e.kind === 'evidence') for (const s of (last as ClaimVersion).sources) codes.add(s);
      else for (const id of e.cites) for (const s of v.claims.find((x) => x.id === id)?.versions.at(-1)?.sources ?? []) codes.add(s);
      return `<article class="entry" data-entry="${esc(e.id)}" data-level="${level ?? 'none'}">
<h3>${esc(e.kind === 'evidence' ? e.subject : e.name)} <span class="id">${esc(e.id)}</span></h3>
<p class="level">${esc(levelText(level))}</p>
<p>${esc(statement)}</p>
<p class="meta">Sources: ${codes.size ? [...codes].sort().map(sourceName).join('; ') : 'none stated'}.</p>
</article>`;
    })
    .join('\n');

  const gaps = v.expectations
    .filter((x) => x.timeline[x.timeline.length - 1]?.state === 'not-observed')
    .map((x) => `${esc(x.what)} Expected from ${sourceName(x.fromSource)}, not observed. It limits ${x.limits.map((id) => `${esc(entryTitle(id))} <span class="id">${esc(id)}</span>`).join(', ')}.`);

  const assumptions: string[] = [];
  for (const r of v.rules) if ((r.basis === 'ASSUMPTION' || r.basis === 'FICTION') && plainNote(r.sourceNote)) assumptions.push(`${esc(r.name)} <span class="id">${esc(r.id)}</span>. ${esc(plainNote(r.sourceNote))}`);

  const sig = (s: Signer): string => `<tr><td>${esc(s.displayName)}, ${esc(s.role)} (demo account)</td><td>${esc(s.action)}</td><td>${esc(s.reason)}</td><td class="id">${esc(s.at)}</td></tr>`;
  const dissemination = [...p.recipients].sort((a, b) => a.order - b.order).map((r) => `<li>${esc(r.title)} ${ROLE_MARK}</li>`);

  const body = [
    section('Case', head),
    section('Key judgements', judgements),
    section('Evidence and levels', evidence),
    section('Collection gaps', list(gaps)),
    section('Not established', list(p.assessment.notEstablished.map(esc))),
    section('Assumptions', list(assumptions)),
    section('Sign-off', `<table><thead><tr><th>Who</th><th>Action</th><th>Reason</th><th>Time</th></tr></thead><tbody>${sig(p.analyst)}${sig(p.supervisor)}</tbody></table>`),
    section('Dissemination', `<ol class="dissemination">${dissemination.join('')}</ol>`),
    section('Handling', `<p class="closing">${esc(CLOSING)}</p><p class="about">${esc(ABOUT)}</p>`),
  ].join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Referral ${esc(p.caseRef)} (simulated)</title>
<style>
body{font-family:Georgia,"Times New Roman",serif;color:#1b1b1b;background:#fff;max-width:46rem;margin:2rem auto;padding:0 1.25rem;line-height:1.5}
h1{font-size:1.5rem;margin:.25rem 0}
h2{font-size:1.05rem;border-bottom:1px solid #999;padding-bottom:.25rem;margin-top:2rem}
h3{font-size:1rem;margin:.75rem 0 .1rem}
.handling{font:700 .8rem/1 ui-monospace,Consolas,monospace;letter-spacing:.12em;color:#8a1c1c;text-align:center;margin:.5rem 0}
.stamp{display:inline-block;font:700 .7rem/1 ui-monospace,Consolas,monospace;letter-spacing:.12em;border:1.5px solid #8a1c1c;color:#8a1c1c;padding:.2rem .4rem;margin-right:.5rem;vertical-align:middle}
.id{font-family:ui-monospace,Consolas,"Courier New",monospace;font-size:.88em}
.meta{color:#555;font-size:.9rem;margin:.1rem 0}
.level{font-weight:700;margin:.1rem 0}
.entry{border-left:3px solid #bbb;padding-left:.75rem;margin:.75rem 0;break-inside:avoid}
.entry[data-level="5"]{border-left-color:#1b1b1b}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{border-bottom:1px solid #ccc;text-align:left;padding:.35rem .4rem;vertical-align:top}
.closing{font-weight:700}
.about{color:#555;font-size:.9rem}
</style>
</head>
<body>
<p class="handling">${HANDLING}</p>
<h1>Referral <span class="id">${esc(p.caseRef)}</span></h1>
${body}
<p class="handling">${HANDLING}</p>
</body>
</html>
`;
}
