// Host-neutral request and response shapes. Nothing in api/ except server.ts knows about node:http.

export interface ApiRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  /** Lower-case header names. */
  headers: Record<string, string>;
  /** Raw body text, or an already parsed value when a host has parsed it. */
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type Handler = (req: ApiRequest) => ApiResponse | Promise<ApiResponse>;
export type Route = [method: string, pattern: string, handler: Handler];

export const MAX_BODY_BYTES = 2048;
export const BROWSER_ID = /^[a-f0-9-]{16,64}$/;

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};

/** A refusal carries a machine code and a human sentence. Neither ever echoes request input. */
export class Refusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly reason: string,
  ) {
    super(reason);
  }
}

export function json(status: number, body: object, headers: Record<string, string> = {}): ApiResponse {
  return {
    status,
    body: Array.isArray(body) ? body : { simulated: true, ...body },
    headers: { 'content-type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...headers },
  };
}

export function refusalResponse(r: Refusal): ApiResponse {
  return json(r.status, { error: { code: r.code, message: r.reason } });
}

export function html(status: number, text: string, headers: Record<string, string>): ApiResponse {
  return { status, body: text, headers: { 'content-type': 'text/html; charset=utf-8', ...SECURITY_HEADERS, ...headers } };
}

export function browserId(req: ApiRequest): string {
  const id = req.headers['x-browser-id'];
  if (!id || !BROWSER_ID.test(id)) {
    throw new Refusal(400, 'bad-browser-id', 'A valid anonymous browser id is required in the x-browser-id header.');
  }
  return id;
}

/** The body as a plain object with only allowed keys. An empty body is {} when `optional`, else refused. */
export function parseBody(req: ApiRequest, allowed: readonly string[], optional = false): Record<string, unknown> {
  if (optional && (req.body === undefined || req.body === null || req.body === '')) return {};
  let value = req.body;
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > MAX_BODY_BYTES) throw new Refusal(400, 'body-too-large', 'The request body is larger than 2 KB.');
    try {
      value = JSON.parse(value);
    } catch {
      throw new Refusal(400, 'invalid-json', 'The request body is not valid JSON.');
    }
  } else if (value !== undefined && value !== null && JSON.stringify(value).length > MAX_BODY_BYTES) {
    throw new Refusal(400, 'body-too-large', 'The request body is larger than 2 KB.');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Refusal(400, 'body-not-object', 'The request body must be a JSON object.');
  for (const k of Object.keys(value)) if (!allowed.includes(k)) throw new Refusal(400, 'unknown-field', 'The request body has a field this endpoint does not accept.');
  return value as Record<string, unknown>;
}

/** Accepts the raw body text or a pre-parsed object. Exactly the listed keys, each a string matching its pattern or list. */
export function readBody(req: ApiRequest, spec: Record<string, RegExp | readonly string[]>, optional: readonly string[] = []): Record<string, string> {
  const obj = parseBody(req, Object.keys(spec));
  const out: Record<string, string> = {};
  for (const [k, rule] of Object.entries(spec)) {
    const v = obj[k];
    if (!Object.prototype.hasOwnProperty.call(obj, k)) {
      if (optional.includes(k)) continue;
      throw new Refusal(400, 'missing-field', 'The request body is missing a required field.');
    }
    if (typeof v !== 'string') throw new Refusal(400, 'wrong-type', 'A field in the request body has the wrong type.');
    const ok = Array.isArray(rule) ? (rule as readonly string[]).includes(v) : (rule as RegExp).test(v);
    if (!ok) throw new Refusal(400, 'bad-value', 'A field in the request body has a value this endpoint does not accept.');
    out[k] = v;
  }
  return out;
}
