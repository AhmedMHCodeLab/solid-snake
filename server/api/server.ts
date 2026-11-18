// Thin node:http adapter around the route table. Run with `npm run api`. PORT overrides 8787.
// In a container the same process also serves the built web app (STATIC_DIR), so one port carries both.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './index';
import type { Api } from './index';
import { auditKeyFrom } from './store';
import { MAX_BODY_BYTES } from './http';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
// Same-origin only: the app loads nothing from anywhere else. Inline styles are allowed because the map sets them.
const CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const SECURITY = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' };

/** The page's own inline scripts are allowed by hash, so nothing injected into a page can run. */
const csp = (html: string): string => {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => ` 'sha256-${createHash('sha256').update(m[1] as string).digest('base64')}'`);
  return `${CSP}; script-src 'self'${hashes.join('')}`;
};

function send(res: ServerResponse, status: number, type: string, body: string | Buffer, extra: Record<string, string> = {}, head = false) {
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(body), ...SECURITY, ...extra });
  res.end(head ? undefined : body);
}

/** Serves one file from root. Anything that resolves outside root, or is not a file, is a 404. */
function serveStatic(res: ServerResponse, method: string, root: string, pathname: string) {
  if (method !== 'GET' && method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed', { allow: 'GET, HEAD' });
  let p: string;
  try {
    p = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', 'Bad request');
  }
  if (p.includes('\0')) return send(res, 400, 'text/plain; charset=utf-8', 'Bad request');
  if (p.endsWith('/')) p += 'index.html';
  const file = resolve(root, `.${p}`);
  if ((file !== root && !file.startsWith(root + sep)) || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
  const data = readFileSync(file);
  const html = extname(file) === '.html';
  send(res, 200, TYPES[extname(file)] ?? 'application/octet-stream', data, { 'cache-control': p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', ...(html ? { 'content-security-policy': csp(data.toString('utf8')) } : {}) }, method === 'HEAD');
}

/**
 * Loopback unless the deployment says otherwise. The platform has no authentication beyond a demo account header, so
 * binding wider is an explicit choice: a container sets HOST=0.0.0.0 and the ingress in front of it decides who may reach it.
 */
export const HOST = '127.0.0.1';

export function startServer(api: Api, port: number, host: string = HOST, staticDir?: string): Promise<Server> {
  const root = staticDir ? resolve(staticDir) : undefined;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      // keep one byte more than the cap so the handler can tell "too large" from "exactly full"; discard the rest
      if (size <= MAX_BODY_BYTES) chunks.push(c);
      size += c.length;
    });
    req.on('end', async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      // Liveness for the container health check: no state is read or written.
      if (url.pathname === '/healthz') return send(res, 200, 'text/plain; charset=utf-8', 'ok', { 'cache-control': 'no-store' });
      if (root && !url.pathname.startsWith('/api/')) return serveStatic(res, req.method ?? 'GET', root, url.pathname);
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers[k] = Array.isArray(v) ? v.join(',') : v;
      const text = Buffer.concat(chunks).toString('utf8');
      const out = await api.handle({
        method: req.method ?? 'GET',
        path: url.pathname,
        query: url.searchParams,
        headers,
        body: size > MAX_BODY_BYTES ? 'x'.repeat(MAX_BODY_BYTES + 1) : text === '' ? undefined : text,
      });
      const payload = out.body === undefined ? '' : typeof out.body === 'string' ? out.body : JSON.stringify(out.body);
      res.writeHead(out.status, { ...SECURITY, 'cache-control': 'no-store', ...out.headers, 'content-length': Buffer.byteLength(payload) });
      res.end(payload);
    });
  });
  return new Promise((ok) => server.listen(port, host, () => ok(server)));
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = resolve(fileURLToPath(import.meta.url), '..', '..', '..');
  const env = process.env;
  // Configuration: HOST, PORT, DATA_DIR (generated case data, read-only), RUNTIME_DIR (the audit log: mount persistent
  // storage here), STATIC_DIR (the built web app; unset means API only), AUDIT_HMAC_KEY or AUDIT_HMAC_KEY_FILE (required;
  // the process exits without it).
  const api = createApi({
    dataDir: resolve(env.DATA_DIR ?? resolve(root, 'data', 'generated')),
    runtimeDir: resolve(env.RUNTIME_DIR ?? resolve(root, 'data', 'runtime')),
    auditKey: auditKeyFrom(env),
    now: () => new Date(),
  });
  const host = env.HOST ?? HOST;
  const port = Number(env.PORT ?? 8787);
  const server = await startServer(api, port, host, env.STATIC_DIR);
  console.log(`SOLID SNAKE (simulated) on http://${host}:${port}${env.STATIC_DIR ? ` serving ${resolve(env.STATIC_DIR)}` : ''}`);
  // As PID 1 in a container node ignores SIGTERM unless it has a handler. Stop accepting, drop idle connections, exit 0;
  // audit appends are synchronous, so nothing is half written. The timer is a backstop for a stuck connection.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      console.log(`${signal} received, shutting down`);
      server.close(() => process.exit(0));
      server.closeIdleConnections();
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}
