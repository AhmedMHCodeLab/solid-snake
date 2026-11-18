// Append-only, hash-chained NDJSON audit log, one file per workspace under data/runtime. Lines are never rewritten or
// deleted. Workspace state is folded from these events, so every state change is an audit event by construction.
//
// Three independent checks, because a hash chain alone proves only that lines agree with each other:
//   1. hash chain: each event carries the hash of its predecessor and of itself (detects an edited or reordered line);
//   2. signature: each line carries an HMAC-SHA256 under a secret the deployment supplies (see auditKeyFrom). The secret is
//      never stored beside the log and never generated here: without it the store refuses to start (fail closed), so a
//      forger who can write the log and recompute the plain hashes still cannot produce a valid line;
//   3. head record: the sequence number and hash of the last event, kept in a separate file written atomically after every
//      append and itself signed, so cutting lines off the end of the log is detected.
// State is folded only from the verified prefix, and every write is refused while any check fails.
import { createHash, createHmac } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditEvent } from '../../shared/types';

export const GENESIS = '0'.repeat(64);
export const MIN_KEY_CHARS = 32;

/**
 * The audit signing secret, from the deployment: AUDIT_HMAC_KEY (the secret itself) or AUDIT_HMAC_KEY_FILE (a path to a
 * mounted secret, for example a Key Vault reference surfaced as a file). Neither set, or a secret shorter than
 * MIN_KEY_CHARS, throws: there is no default and no generated replacement.
 */
export function auditKeyFrom(env: Record<string, string | undefined>): string {
  const file = env.AUDIT_HMAC_KEY_FILE;
  const key = (file ? readFileSync(file, 'utf8') : env.AUDIT_HMAC_KEY ?? '').trim();
  if (key.length < MIN_KEY_CHARS) throw new Error(`The audit signing key is missing or shorter than ${MIN_KEY_CHARS} characters. Set AUDIT_HMAC_KEY or AUDIT_HMAC_KEY_FILE. The platform does not start without it.`);
  return key;
}

/** JSON with object keys sorted at every depth, so the hash does not depend on key order. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}

export const hashOf = (e: Omit<AuditEvent, 'hash'>): string => createHash('sha256').update(e.prevHash + canonical(e)).digest('hex');

export type NewEvent = Omit<AuditEvent, 'simulated' | 'seq' | 'prevHash' | 'hash'>;

export interface Verdict {
  /** True only when all three checks hold. */
  ok: boolean;
  /** Lines in the log file. */
  length: number;
  /** 1-based line number of the first line that fails the hash chain or its signature. */
  brokenAt?: number;
  hashChain: boolean;
  signatures: boolean;
  /** The head record exists, is signed, and agrees with the log (no truncation). */
  head: boolean;
  headSeq: number | null;
  reason?: string;
}

/** Thrown by append when the log fails verification. The API answers 409 audit-chain-broken. */
export class ChainBroken extends Error {
  constructor(readonly verdict: Verdict) {
    super('The audit chain failed verification.');
  }
}

interface Head { seq: number; hash: string; mac: string }

export function createStore(runtimeDir: string, auditKey: string) {
  if (auditKey.length < MIN_KEY_CHARS) throw new Error(`The audit signing key must be at least ${MIN_KEY_CHARS} characters.`);
  const file = (ws: string) => join(runtimeDir, `audit-${ws}.ndjson`);
  const headFile = (ws: string) => join(runtimeDir, `audit-${ws}.head.json`);

  const mac = (text: string): string => createHmac('sha256', auditKey).update(text).digest('hex');
  const eventMac = (e: AuditEvent): string => mac(`event:${canonical(e)}`);
  const headMac = (ws: string, seq: number, hash: string): string => mac(`head:${ws}:${seq}:${hash}`);

  function lines(ws: string): string[] {
    try {
      return readFileSync(file(ws), 'utf8').split('\n').filter(Boolean);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }

  function readHead(ws: string): Head | null {
    try {
      const h = JSON.parse(readFileSync(headFile(ws), 'utf8')) as Head;
      return typeof h.seq === 'number' && typeof h.hash === 'string' && typeof h.mac === 'string' ? h : null;
    } catch {
      return null;
    }
  }

  /** The verified prefix of the log and the verdict on the whole file. Events are returned without their signatures. */
  function load(ws: string): { events: AuditEvent[]; verdict: Verdict } {
    const ls = lines(ws);
    const events: AuditEvent[] = [];
    let prev = GENESIS;
    let brokenAt: number | undefined;
    let hashChain = true;
    let signatures = true;
    let reason: string | undefined;
    const all: AuditEvent[] = [];
    for (let i = 0; i < ls.length; i++) {
      let line: AuditEvent & { mac?: string };
      try {
        line = JSON.parse(ls[i] as string) as AuditEvent & { mac?: string };
      } catch {
        hashChain = false;
        brokenAt ??= i + 1;
        reason ??= 'A line of the log is not valid JSON.';
        break;
      }
      const { mac: sig, ...e } = line;
      all.push(e as AuditEvent);
      if (brokenAt !== undefined) continue;
      const { hash, ...rest } = e as AuditEvent;
      if (e.seq !== i + 1 || e.prevHash !== prev || hash !== hashOf(rest)) {
        hashChain = false;
        brokenAt = i + 1;
        reason = 'An event does not match the hash chain.';
        continue;
      }
      if (typeof sig !== 'string' || sig !== eventMac(e as AuditEvent)) {
        signatures = false;
        brokenAt = i + 1;
        reason = 'An event carries no valid signature from this install.';
        continue;
      }
      events.push(e as AuditEvent);
      prev = hash;
    }
    const head = readHead(ws);
    let headOk = true;
    if (!head) {
      if (ls.length > 0) {
        headOk = false;
        reason ??= 'The head record is missing.';
      }
    } else if (head.mac !== headMac(ws, head.seq, head.hash)) {
      headOk = false;
      reason ??= 'The head record is not signed by this install.';
    } else if (all.length < head.seq) {
      headOk = false;
      reason ??= `The log ends at event ${all.length} but its head record says ${head.seq}: lines were cut off.`;
    } else if ((all[head.seq - 1] as AuditEvent).hash !== head.hash) {
      headOk = false;
      reason ??= 'The event at the head position is not the one the head record names.';
    }
    const ok = hashChain && signatures && headOk;
    return { events, verdict: { ok, length: ls.length, ...(brokenAt === undefined ? {} : { brokenAt }), hashChain, signatures, head: headOk, headSeq: head?.seq ?? null, ...(reason && !ok ? { reason } : {}) } };
  }

  const verify = (ws: string): Verdict => load(ws).verdict;
  const read = (ws: string): AuditEvent[] => load(ws).events;

  /** Appends after verifying the log; writes the signed head record atomically afterwards. */
  function append(ws: string, events: NewEvent[]): AuditEvent[] {
    if (events.length === 0) return [];
    const { events: prior, verdict } = load(ws);
    if (!verdict.ok) throw new ChainBroken(verdict);
    let prev = prior[prior.length - 1];
    const out: AuditEvent[] = [];
    for (const e of events) {
      const body = { simulated: true as const, seq: (prev?.seq ?? 0) + 1, ...e, prevHash: prev?.hash ?? GENESIS };
      const full: AuditEvent = { ...body, hash: hashOf(body) };
      out.push(full);
      prev = full;
    }
    mkdirSync(runtimeDir, { recursive: true });
    appendFileSync(file(ws), out.map((x) => JSON.stringify({ ...x, mac: eventMac(x) }) + '\n').join(''));
    const last = out[out.length - 1] as AuditEvent;
    const tmp = `${headFile(ws)}.tmp`;
    writeFileSync(tmp, JSON.stringify({ seq: last.seq, hash: last.hash, mac: headMac(ws, last.seq, last.hash) } satisfies Head));
    renameSync(tmp, headFile(ws));
    return out;
  }

  return { read, load, append, verify, file, headFile, eventMac };
}
export type Store = ReturnType<typeof createStore>;
