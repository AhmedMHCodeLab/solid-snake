// The demo connector binding. This is the only place scenario knowledge enters the platform:
// a detection is served by the scenario whose evidence records it rests on, by record-id membership.
// A real connector replaces this; detection never sees it.
import type { CaseFile, CaseId, Detection } from '../../shared/types';
import { CASE_IDS } from './feed';

/** Record ids each scenario's evidence names: records cited by claim versions and by indicators. */
export function scenarioEvidence(cases: Record<CaseId, CaseFile>): Map<CaseId, Set<string>> {
  const out = new Map<CaseId, Set<string>>();
  for (const id of CASE_IDS) {
    const c = cases[id];
    const ids = new Set<string>();
    const recordIds = new Set([...c.records.scscf, ...c.records.ibcf].map((x) => x.id));
    for (const cl of c.claims) for (const v of cl.versions) for (const e of v.evidenceIds) if (recordIds.has(e)) ids.add(e);
    for (const ind of c.indicators) for (const r of ind.recordIds) ids.add(r);
    out.set(id, ids);
  }
  return out;
}

/** The scenario holding at least half of a detection's records, or null for background traffic. */
export function bindScenario(d: Pick<Detection, 'recordIds'>, evidence: Map<CaseId, Set<string>>): CaseId | null {
  let best: { id: CaseId; share: number } | null = null;
  for (const [id, set] of evidence) {
    const share = d.recordIds.filter((r) => set.has(r)).length / Math.max(1, d.recordIds.length);
    if (!best || share > best.share) best = { id, share };
  }
  return best && best.share >= 0.5 ? best.id : null;
}
