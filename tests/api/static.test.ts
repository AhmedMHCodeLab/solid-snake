// The server also serves the built web app in a container: it must serve files from STATIC_DIR only, answer the
// health check without touching state, and leave the API routes untouched.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer } from '../../server/api/server';
import { makeApi } from './helpers';

let base: string;
let stop: () => void;
const INLINE = 'document.documentElement.dataset.theme="dark"';

/** A raw request: the path is sent exactly as written, with no normalisation by a client library. */
function get(path: string, method = 'GET'): Promise<{ status: number; type: string | undefined; body: string; headers: Record<string, string | string[] | undefined> }> {
  const { port } = new URL(base);
  return new Promise((ok, fail) => {
    const req = request({ host: '127.0.0.1', port: Number(port), path, method }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => ok({ status: res.statusCode ?? 0, type: res.headers['content-type'], body, headers: res.headers }));
    });
    req.on('error', fail);
    req.end();
  });
}

beforeAll(async () => {
  const outside = mkdtempSync(join(tmpdir(), 'ss-out-'));
  writeFileSync(join(outside, 'secret.txt'), 'TOP-SECRET');
  // the static root sits next to the secret, so a traversal needs only one step up
  const root = join(outside, 'web');
  mkdirSync(join(root, 'assets'), { recursive: true });
  mkdirSync(join(root, 'console'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>home</title>');
  writeFileSync(join(root, 'console', 'index.html'), `<!doctype html><title>console</title><script>${INLINE}</script><script type="module" src="/assets/app.js"></script>`);
  writeFileSync(join(root, 'assets', 'app.js'), 'console.log(1)');
  const server = await startServer(makeApi().api, 0, '127.0.0.1', root);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  stop = () => server.close();
});
afterAll(() => stop());

describe('static files and health', () => {
  it('serves the app with a type, no sniffing and a content security policy; assets are cacheable', async () => {
    const home = await get('/');
    expect([home.status, home.type, home.body]).toEqual([200, 'text/html; charset=utf-8', '<!doctype html><title>home</title>']);
    expect(home.headers['x-content-type-options']).toBe('nosniff');
    expect(String(home.headers['content-security-policy'])).toContain("default-src 'self'");
    const page = await get('/console/');
    expect(page.body).toContain('console');
    // only the page's own inline script is allowed, by hash; the external module script needs no hash
    const policy = String(page.headers['content-security-policy']);
    expect(policy).toContain(`script-src 'self' 'sha256-${createHash('sha256').update(INLINE).digest('base64')}'`);
    expect(policy.match(/sha256-/g)).toHaveLength(1);
    expect(String(home.headers['content-security-policy'])).toContain("script-src 'self'");
    expect(String(home.headers['content-security-policy'])).not.toContain('sha256-');
    const js = await get('/assets/app.js');
    expect([js.status, js.type]).toEqual([200, 'text/javascript; charset=utf-8']);
    expect(String(js.headers['cache-control'])).toContain('immutable');
  });

  it('never serves a file outside the static root, however the path is written', async () => {
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/..%2fsecret.txt', '/%2e%2e%2fsecret.txt', '/assets/..%2f..%2fsecret.txt', '/..%5csecret.txt', '/%00', '/%']) {
      const r = await get(p);
      expect(r.body, p).not.toContain('TOP-SECRET');
      expect([404, 400], p).toContain(r.status);
    }
    expect((await get('/missing.html')).status).toBe(404);
    expect((await get('/assets')).status).toBe(404);
  });

  it('refuses writes to static paths, answers HEAD without a body, and answers the health check without state', async () => {
    expect((await get('/', 'POST')).status).toBe(405);
    const head = await get('/', 'HEAD');
    expect([head.status, head.body]).toEqual([200, '']);
    expect(await get('/healthz')).toMatchObject({ status: 200, body: 'ok' });
  });

  it('leaves the API routes alone, with no-store and no-sniff on every answer', async () => {
    const r = await get('/api/session');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['cache-control']).toBe('no-store');
    expect(r.type).toContain('application/json');
    expect((await get('/api/nonsense')).status).toBe(404);
  });
});
