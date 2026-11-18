// Typed client for the platform API (scratchpad/platform-api-contract.md). Plain fetch, no dependency.
// Every request carries x-browser-id (one demo workspace per browser) and, after sign-in, x-demo-user.
// Types the contract lacked come from the API code as types only: no server code enters the bundle.
import type { AuditEvent, CollectionRequest, ConnectorInfo, DemoUser, Level, Rule, SourceCode, StepTrigger } from '../../../shared/types';
import type { FeedStatus, LevelHistory, PlatformAlert, PlatformCaseRow, PlatformSendRow, PlatformSignRow, PlatformView } from '../../../server/api/index';

export type { FeedStatus, LevelHistory };
export type Alert = PlatformAlert;
export type CaseRow = PlatformCaseRow;
type SendRow = PlatformSendRow;
type SignRow = PlatformSignRow;
export interface Session { users: DemoUser[]; workspace: { id: string; feed: FeedStatus; audit?: { ok: boolean } }; connectors: ConnectorInfo[]; dismissReasons?: { code: string; label: string }[]; detectionRules?: Rule[] }
/** The server's recomputed levels are the levels shown. */
export interface ServerLevel { entryId: string; level: Level | null; levelName: string; issues: string[] }
export interface CaseView { case: CaseRow; view: PlatformView; levels?: ServerLevel[]; /** Levels recomputed by the platform at every released step: step, then entry id. */ levelHistory: LevelHistory; /** The analyst whose signature is current, or null. */ signedBy: string | null; next: { trigger: StepTrigger; actionLabel: string } | null; pending: CollectionRequest[] }
export interface Refusal { status: number; code: string; message: string }

const store = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: the session still works */ } },
};
export function browserId(): string {
  let id = store.get('ss-browser');
  if (!id) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
    store.set('ss-browser', id);
  }
  return id;
}
/** A new anonymous workspace: the old one is left exactly as it is, for investigation. */
export function newWorkspace(): void {
  store.set('ss-browser', Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''));
}
export const currentUser = () => store.get('ss-user');
export const setUser = (id: string) => store.set('ss-user', id);

export class ApiError extends Error {
  constructor(public refusal: Refusal) { super(refusal.message); }
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'x-browser-id': browserId() };
  const u = currentUser();
  if (u) headers['x-demo-user'] = u;
  if (body !== undefined) headers['content-type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError({ status: 0, code: 'unreachable', message: 'The platform service did not answer. Check that it is running.' });
  }
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!res.ok) {
    const e = (data && typeof data === 'object' && 'error' in data ? (data as { error: { code: string; message: string } }).error : null) ?? { code: String(res.status), message: `The service refused the request (${res.status}).` };
    throw new ApiError({ status: res.status, code: e.code, message: e.message });
  }
  return data as T;
}

const enc = encodeURIComponent;
export const api = {
  session: () => call<Session>('GET', '/api/session'),
  feedStatus: () => call<FeedStatus>('GET', '/api/feed/status'),
  feedStart: (speed?: number) => call<FeedStatus>('POST', '/api/feed/start', speed ? { speed } : {}),
  feedPause: () => call<FeedStatus>('POST', '/api/feed/pause', {}),
  reset: () => call<unknown>('POST', '/api/workspace/reset', {}),
  alerts: () => call<Alert[]>('GET', '/api/alerts'),
  baseline: (id: string, offset = 0, limit = 12) => call<{ population: { count: number; sha256: string }; recordIds: string[] }>('GET', `/api/alerts/${enc(id)}/baseline?offset=${offset}&limit=${limit}`),
  dismiss: (id: string, reasonCode: string) => call<Alert>('POST', `/api/alerts/${enc(id)}/dismiss`, { reasonCode }),
  openCase: (alertId: string) => call<CaseRow>('POST', `/api/alerts/${enc(alertId)}/open`, {}),
  cases: () => call<CaseRow[]>('GET', '/api/cases'),
  caseView: (ref: string) => call<CaseView>('GET', `/api/cases/${enc(ref)}`),
  action: (ref: string, kind: 'collect' | 'hypotheses' | 'test', source?: SourceCode) => call<CollectionRequest | CaseRow>('POST', `/api/cases/${enc(ref)}/actions`, source ? { kind, source } : { kind }),
  records: (ref: string, q: { ids?: string[]; entry?: string; level?: number; offset?: number; limit?: number }) => {
    const p = new URLSearchParams();
    if (q.ids) p.set('ids', q.ids.join(','));
    if (q.entry) { p.set('entry', q.entry); p.set('level', String(q.level ?? 1)); p.set('offset', String(q.offset ?? 0)); p.set('limit', String(q.limit ?? 20)); }
    return call<{ total: number; records: Record<string, unknown>[]; evidenceItems?: unknown[] }>('GET', `/api/cases/${enc(ref)}/records?${p}`);
  },
  signoffRows: (ref: string) => call<SignRow[] | { rows: SignRow[] }>('GET', `/api/cases/${enc(ref)}/signoff`).then((r) => (Array.isArray(r) ? r : r.rows ?? [])),
  signoff: (ref: string, entryId: string, action: 'promote' | 'hold' | 'reject', reasonCode: string) => call<unknown>('POST', `/api/cases/${enc(ref)}/signoff`, { entryId, action, reasonCode }),
  supervisor: (ref: string, entryId: string, checks: { id: string; passed: boolean }[]) => call<unknown>('POST', `/api/cases/${enc(ref)}/supervisor`, { entryId, checks }),
  referral: (ref: string, entryId?: string) => call<unknown>('POST', `/api/cases/${enc(ref)}/referral`, entryId ? { entryId } : {}),
  referralLog: (ref: string) => call<SendRow[] | { rows: SendRow[] }>('GET', `/api/cases/${enc(ref)}/referral/log`).then((r) => (Array.isArray(r) ? r : r.rows ?? [])),
  packet: async (ref: string): Promise<Blob> => {
    const headers: Record<string, string> = { 'x-browser-id': browserId() };
    const u = currentUser();
    if (u) headers['x-demo-user'] = u;
    const res = await fetch(`/api/cases/${enc(ref)}/referral/packet`, { headers });
    if (!res.ok) throw new ApiError({ status: res.status, code: 'packet', message: 'The packet is not available yet.' });
    return res.blob();
  },
  audit: (caseRef?: string) => call<AuditEvent[]>('GET', `/api/audit${caseRef ? `?caseRef=${enc(caseRef)}` : ''}`),
  verify: () => call<{ ok: boolean; length: number; brokenAt?: number; reason?: string; hashChain: boolean; signatures: boolean; head: boolean }>('GET', '/api/audit/verify'),
};
