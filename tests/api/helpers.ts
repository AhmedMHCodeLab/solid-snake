// Shared harness: an API over a temp runtime dir with a clock the test moves, called through the route table.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApi } from '../../server/api/index';
import type { ApiResponse, PlatformAlert, PlatformCaseRow } from '../../server/api/index';
import type { CaseFile, CaseId, StepTrigger } from '../../shared/types';
import { CASE_IDS, loadCases } from '../../server/engine/feed';
import { bindScenario, scenarioEvidence } from '../../server/engine/bind';

/** Test-only secret. A real deployment supplies its own through the environment. */
export const TEST_AUDIT_KEY = 'test-only-audit-key-0123456789abcdef0123';
export const DATA = join(process.cwd(), 'data', 'generated');
export const cases: Record<CaseId, CaseFile> = loadCases(DATA);
export { CASE_IDS };
const evidence = scenarioEvidence(cases);
/** The demo binding of an alert to a scenario, computed here by the test from the case files. The API never serves it. */
export const scenarioOf = (a: PlatformAlert): CaseId | null => bindScenario(a.detection, evidence);
export const T0 = new Date('2031-04-01T09:00:00.000Z');
export const bid = (n: number): string => 'abcdef01' + n.toString(16).padStart(8, '0');
export const text = (r: ApiResponse): string => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body));
export const ANALYST = 'analyst-1';
export const ANALYST2 = 'analyst-2';
export const SUPERVISOR = 'supervisor-1';

export interface CaseGet {
  case: PlatformCaseRow;
  view: Omit<CaseFile, 'id' | 'code'> & { id: string; code: string; assessment: unknown };
  levelHistory: Record<string, Record<string, number | null>>;
  signedBy: string | null;
  levels: { entryId: string; level: number | null; issues: string[] }[];
  next: { trigger: StepTrigger; actionLabel: string } | null;
  pending: { id: string; source: string }[];
}

export function makeApi(dataDir = DATA) {
  const runtimeDir = mkdtempSync(join(tmpdir(), 'ss-api-'));
  let now = T0.getTime();
  const api = createApi({ dataDir, runtimeDir, auditKey: TEST_AUDIT_KEY, now: () => new Date(now) });
  const advance = (seconds: number) => void (now += seconds * 1000);
  const call = (method: string, url: string, o: { browser?: string; user?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<ApiResponse> => {
    const u = new URL(url, 'http://x');
    const headers: Record<string, string> = { ...(o.headers ?? {}) };
    if (o.browser) headers['x-browser-id'] = o.browser;
    if (o.user) headers['x-demo-user'] = o.user;
    const body = o.body === undefined ? undefined : typeof o.body === 'string' ? o.body : JSON.stringify(o.body);
    return api.handle({ method, path: u.pathname, query: u.searchParams, headers, body });
  };
  /** Path of the audit file of the workspace a browser id maps to (one file per workspace). */
  const auditPath = async (b: string): Promise<string> => join(runtimeDir, `audit-${((await call('GET', '/api/session', { browser: b })).body as { workspace: { id: string } }).workspace.id}.ndjson`);
  const auditLines = async (b: string): Promise<string[]> => {
    const p = await auditPath(b);
    return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter(Boolean) : [];
  };

  /** Starts the feed at full speed and moves the clock past the end of the window. */
  async function replay(b: string) {
    await call('POST', '/api/feed/start', { browser: b, user: ANALYST });
    advance(200);
  }
  const alerts = async (b: string) => (await call('GET', '/api/alerts', { browser: b })).body as PlatformAlert[];
  const getCase = async (b: string, ref: string) => (await call('GET', `/api/cases/${ref}`, { browser: b })).body as CaseGet;

  async function openScenario(b: string, id: CaseId): Promise<string> {
    const a = (await alerts(b)).find((x) => scenarioOf(x) === id && x.status === 'new');
    if (!a) throw new Error(`no alert for scenario ${id}`);
    const r = await call('POST', `/api/alerts/${a.id}/open`, { browser: b, user: ANALYST });
    if (r.status !== 201) throw new Error(`open failed ${text(r)}`);
    return (r.body as PlatformCaseRow).ref;
  }

  /** Runs every analyst action named by next until the sign-off decision is due. Returns the collection statuses seen. */
  async function runToSignoff(b: string, ref: string): Promise<{ source: string; status: string }[]> {
    for (let guard = 0; guard < 40; guard++) {
      const g = await getCase(b, ref);
      const t = g.next?.trigger;
      if (!t || t.kind === 'signoff') return g.case.collections.map((x) => ({ source: x.source, status: x.status }));
      if (t.kind === 'hypotheses') await call('POST', `/api/cases/${ref}/actions`, { browser: b, user: ANALYST, body: { kind: 'hypotheses' } });
      else if (t.kind === 'collect' || t.kind === 'test') {
        const r = await call('POST', `/api/cases/${ref}/actions`, { browser: b, user: ANALYST, body: { kind: t.kind, source: t.source } });
        if (r.status !== 201) throw new Error(`action failed ${text(r)}`);
        advance(11);
      } else throw new Error(`unexpected trigger ${t.kind}`);
    }
    throw new Error('the workflow did not reach sign-off');
  }

  const allChecks = (c: CaseFile, passed = true) => c.signoff.supervisorChecks.map((k) => ({ id: k.id, passed }));
  return { api, call, advance, replay, alerts, getCase, openScenario, runToSignoff, allChecks, runtimeDir, auditPath, auditLines };
}

export const promoteCode = (c: CaseFile): string => (c.signoff.reasonCodes.find((r) => r.actions.includes('promote')) as { code: string }).code;
export const codeFor = (c: CaseFile, entryId: string, action: string): string | undefined => c.signoff.reasonCodes.find((r) => r.actions.includes(action as never) && r.entryIds.includes(entryId))?.code;
