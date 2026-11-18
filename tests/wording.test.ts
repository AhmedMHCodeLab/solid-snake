// V2: level discipline. Every string in every case file is checked against the wording rules of PRODUCT.md 2.4 and 9.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_WORDS } from '../shared/types';
import type { Level } from '../shared/types';
import { CASE_IDS, loadGenerated } from '../server/seed/load';
import { luhnDigit } from '../server/seed/ident';
import { termAppears } from '../server/seed/glossary';

const { cases, truth, manifest, texts } = loadGenerated();
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
const BASES = ['FACT', 'RESEARCH', 'PRACTICE', 'ASSUMPTION', 'FICTION', 'PROPOSAL'];

interface Found {
  path: string;
  text: string;
  level: Level | null;
}

/** Walks every string, tracking the level of the closest enclosing object that carries one. */
export function walk(node: unknown, path: string, level: Level | null, out: Found[]): void {
  if (typeof node === 'string') {
    out.push({ path, text: node, level });
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((x, i) => walk(x, `${path}[${i}]`, level, out));
    return;
  }
  if (node && typeof node === 'object') {
    const o = node as Record<string, unknown>;
    let lv = level;
    if (typeof o.level === 'number' && o.level >= 1 && o.level <= 5) lv = o.level as Level;
    if (o.type === 'level-rise' && typeof o.to === 'number') lv = o.to as Level;
    for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`, lv, out);
  }
}

/** Returns the strings that use a reserved word below level 5. */
export function reservedViolations(found: Found[]): Found[] {
  const re = new RegExp(`\\b(${RESERVED_WORDS.join('|')})\\b`, 'i');
  return found.filter((f) => f.level !== 5 && re.test(f.text));
}

/** A sentence that calls a cell association a location or position, other than to deny it. */
export function cellAssociationViolations(found: Found[]): Found[] {
  return found.filter((f) =>
    f.text
      .split(/(?<=[.;:])\s+/)
      .some((s) => /\bcell (associations?|areas?)\b/i.test(s) && /\b(location|position)\b/i.test(s) && !/\b(not|no|never)\b[^.]{0,20}\b(location|position)\b/i.test(s)),
  );
}

const caseStrings = (id: (typeof CASE_IDS)[number]): Found[] => {
  const { records: _r, ...rest } = cases[id];
  const out: Found[] = [];
  walk(rest, id, null, out);
  return out;
};

/** Strings a reader meets before any technical detail. Specification names, ids, provenance notes and derivations are excluded. */
export function firstLayer(c: (typeof cases)['a']): Found[] {
  const out: Found[] = [];
  const add = (path: string, text: unknown): void => {
    if (typeof text === 'string') out.push({ path, text, level: null });
  };
  add('title', c.title);
  add('lede', c.lede);
  for (const k of ['tasking', 'desk', 'originator'] as const) add(`meta.${k}`, c.meta?.[k]);
  for (const e of c.entities ?? []) {
    add(`entity.${e.id}.plainName`, e.plainName);
    add(`entity.${e.id}.role`, e.role);
  }
  for (const g of c.glossary ?? []) {
    add(`glossary.${g.term}.plain`, g.plain);
    add(`glossary.${g.term}.explain`, g.explain);
  }
  for (const s of c.sources) {
    add(`source.${s.code}.plainName`, s.plainName);
    add(`source.${s.code}.explain`, s.explain);
    add(`source.${s.code}.collectionPoint`, s.collectionPoint);
  }
  c.fieldSpecs.forEach((f, i) => {
    add(`fieldSpec.${i}.plainName`, f.plainName);
    add(`fieldSpec.${i}.explain`, f.explain);
  });
  for (const s of c.steps) {
    add(`${s.id}.title`, s.title);
    add(`${s.id}.actionLabel`, s.actionLabel);
    s.narrative.forEach((b, i) => add(`${s.id}.narrative[${i}]`, b.text));
    for (const e of s.exhibits) for (const k of ['medium', 'collectionPoint', 'window'] as const) add(`${e.id}.${k}`, e.label[k]);
    s.changes.forEach((ch, i) => add(`${s.id}.changes[${i}]`, ch.announce));
  }
  for (const cl of c.claims) {
    add(`${cl.id}.subject`, cl.subject);
    cl.versions.forEach((v, i) => add(`${cl.id}.v${i}`, v.statement));
  }
  for (const h of c.hypotheses) {
    add(`${h.id}.name`, h.name);
    add(`${h.id}.support`, h.support);
    add(`${h.id}.refute`, h.refute);
    h.versions.forEach((v, i) => add(`${h.id}.v${i}`, v.statement));
    h.tests.forEach((t, i) => {
      add(`${h.id}.tests[${i}].description`, t.description);
      add(`${h.id}.tests[${i}].needs`, t.needs);
    });
  }
  for (const i of c.indicators) {
    add(`${i.id}.description`, i.description);
    add(`${i.id}.unit`, i.unit);
    add(`${i.id}.baseline`, i.baseline.description);
    add(`${i.id}.population`, i.baseline.population);
  }
  for (const i of c.independence) add(`${i.id}.statement`, i.statement);
  for (const e of c.evidenceItems) {
    add(`${e.id}.title`, e.title);
    add(`${e.id}.summary`, e.summary);
  }
  for (const e of c.expectations) add(`${e.id}.what`, e.what);
  for (const sh of c.map.shapes) add(`${sh.id}.label`, sh.label);
  for (const m of c.map.states) add(`map.${m.step}.note`, m.note);
  add('map.disclaimer', c.map.casePlate.disclaimer);
  if (c.map.region) add('map.region', c.map.region.label);
  for (const r of c.signoff.reasonCodes) add(`${r.code}.label`, r.label);
  for (const o of c.signoff.openEntries) add(`open.${o.entryId}`, o.lacks);
  for (const k of c.signoff.supervisorChecks) add(`${k.id}.label`, k.label);
  c.assessment.captions.forEach((k, i) => add(`caption[${i}]`, k.text));
  for (const k of ['established', 'suggested', 'notEstablished'] as const) c.assessment[k].forEach((t, i) => add(`${k}[${i}]`, t));
  for (const ch of c.charts ?? []) {
    for (const k of ['title', 'unit', 'xLabel', 'yLabel', 'note'] as const) add(`${ch.id}.${k}`, ch[k]);
    for (const sr of ch.series) add(`${ch.id}.series.${sr.id}`, sr.label);
    if (ch.band) add(`${ch.id}.band`, ch.band.label);
    if (ch.marker) add(`${ch.id}.marker`, ch.marker.label);
    (ch.categories ?? []).forEach((t, i) => add(`${ch.id}.categories[${i}]`, t));
    for (const n of ch.graph?.nodes ?? []) add(`${ch.id}.node.${n.id}`, n.label);
  }
  for (const r of c.recipients) add(`recipient.${r.id}`, `${r.title} ${r.label}`);
  return out;
}

describe('the checkers themselves', () => {
  it('flag a reserved word below level 5 and allow it at level 5', () => {
    const f: Found[] = [
      { path: 'x', text: 'The operator was caught.', level: 3 },
      { path: 'y', text: 'Verified (simulated): confirmed by survey.', level: 5 },
      { path: 'z', text: 'Context with a perpetrator.', level: null },
    ];
    expect(reservedViolations(f).map((x) => x.path)).toEqual(['x', 'z']);
    const out: Found[] = [];
    walk({ level: 5, statement: 'confirmed', other: { text: 'fine' } }, 'p', null, out);
    expect(out.map((x) => x.level)).toEqual([5, 5]);
  });
  it('flag a cell association called a location, and allow its denial', () => {
    const f: Found[] = [
      { path: 'a', text: 'The cell association gives the location of the box.', level: null },
      { path: 'b', text: 'A cell association is not a position.', level: null },
      { path: 'c', text: 'The cell area shows where the device is, a position.', level: null },
      { path: 'd', text: 'A cell area is not a position.', level: null },
    ];
    expect(cellAssociationViolations(f).map((x) => x.path)).toEqual(['a', 'c']);
  });
});

describe.each(CASE_IDS)('V2 wording, case %s', (id) => {
  const c = cases[id];
  const found = caseStrings(id);

  it('reserved words appear only in text attached to a level 5 entry', () => {
    expect(reservedViolations(found).map((f) => `${f.path}: ${f.text}`)).toEqual([]);
  });

  it('every claim block has a level and every context block has a basis and a source note', () => {
    for (const s of c.steps) {
      for (const b of s.narrative) {
        if (b.kind === 'claim') {
          expect([1, 2, 3, 4, 5], `${s.id}`).toContain(b.level);
          expect(b.entryId.length).toBeGreaterThan(0);
        } else if (b.kind === 'context') {
          expect(BASES, `${s.id}`).toContain(b.basis);
          expect(b.sourceNote.length, `${s.id}`).toBeGreaterThan(10);
        } else {
          expect(b.kind).toBe('limit');
        }
        expect(b.text.length).toBeGreaterThan(10);
      }
    }
    for (const r of c.rules) {
      expect(BASES).toContain(r.basis);
      expect(r.sourceNote.length).toBeGreaterThan(10);
      if (r.basis === 'ASSUMPTION') expect(r.sourceNote).toMatch(/ASSUMPTION/);
    }
  });

  it('never says "confirm or refute" and never calls a cell association a location or position', () => {
    for (const f of found) expect(f.text, f.path).not.toMatch(/confirm or refute/i);
    expect(cellAssociationViolations(found).map((f) => `${f.path}: ${f.text}`)).toEqual([]);
  });

  it('names no real operator, regulator or agency', () => {
    const everything: Found[] = [...found];
    walk(c.records, 'records', null, everything);
    for (const f of everything) expect(f.text, f.path).not.toMatch(/Ooredoo|Vodafone|\bCRA\b|Communications Regulatory Authority|Qatar Airways|Metal Gear|Qatar Telecom|Ministry of Interior|Interpol|\bPolice\b|Etisalat|\bAT&T\b/i);
  });

  it('identifier safety: every identifier sits on a code space that belongs to nobody', () => {
    const everything: Found[] = [...found];
    walk(c.records, 'records', null, everything);
    for (const f of everything) {
      const t = f.text;
      expect(t, f.path).not.toMatch(/https?:\/\/|www\.|\.(com|org|net|qa|gov|edu|invalid)\b(?<!3gppnetwork\.org)/i);
      for (const m of t.matchAll(/@([A-Za-z0-9.-]+)/g)) expect(m[1] as string, `${f.path}: ${t}`).toMatch(/\.mcc999\.3gppnetwork\.org$/);
      for (const m of t.matchAll(/[A-Za-z0-9.-]+\.3gppnetwork\.org/g)) expect(m[0], f.path).toMatch(/^([a-z0-9]+\.)*ims\.mnc0\d\d\.mcc999\.3gppnetwork\.org$/);
      for (const m of t.matchAll(/\+(\d+)/g)) expect((m[1] as string).startsWith('999'), `${f.path}: ${t}`).toBe(true);
      for (const m of t.matchAll(/(?<![\w.=])(\d{15,16})(?![\d])/g)) {
        const d = m[1] as string;
        if (d.startsWith('999')) expect(d.length, 'IMSI length').toBe(15);
        else {
          expect(d.startsWith('0099'), `${f.path}: ${d} is neither IMSI-shaped on 999 nor in the test device range`).toBe(true);
          if (d.length === 15) expect(luhnDigit(d.slice(0, 14)), `${d} check digit`).toBe(d[14]);
        }
      }
      for (const m of t.matchAll(/sip:(\+?\d+)@/g)) expect((m[1] as string).length, `${f.path}: ${t}`).toBeLessThanOrEqual(16);
    }
  });

  it('first-layer text uses no specification abbreviation and no fiction label', () => {
    const t = firstLayer(c);
    const BANNED = /\b(S-CSCF|IBCF|CDR|ECGI|TAI|IMSI|IMEI|IMPU|MSISDN|NNI|IOI|ICID|VoLTE|M2M|IoT|MNO|UE|SIP)\b/;
    for (const f of t) {
      const text = f.text;
      expect(text, `${f.path}`).not.toMatch(BANNED);
      expect(text, `${f.path}`).not.toMatch(/\bfiction(al)?\b/i);
      expect(text, `${f.path}`).not.toMatch(/\b(exhibit|tour|storyboard|walk-through|scroll)\b/i);
    }
    expect(t.length).toBeGreaterThan(100);
  });

  it('every technical term that appears outside the first layer is in the glossary', () => {
    const { glossary, ...rest } = c;
    const text = JSON.stringify(rest);
    const terms = ['S-CSCF', 'IBCF', 'CDR', 'ECGI', 'TAI', 'IMSI', 'IMEI', 'IMPU', 'MSISDN', 'NNI', 'IOI', 'ICID', 'VoLTE', 'M2M', 'IoT', 'MNO', 'UE', 'SIP', 'IMS', 'PBX', 'IPX', 'MCC', 'MNC'];
    for (const term of terms) if (termAppears(text, term)) expect(glossary!.some((g) => g.term === term), `${id}: ${term}`).toBe(true);
  });

  it('uses no em dash and no en dash', () => {
    expect(texts[`case-${id}.json`]).not.toMatch(DASHES);
  });

  it('marks everything simulated', () => {
    expect(c.simulated).toBe(true);
    for (const r of [...c.records.scscf, ...c.records.ibcf]) expect(r.simulated, r.id).toBe(true);
    for (const e of c.evidenceItems) expect(e.simulated, e.id).toBe(true);
    for (const s of c.map.states) expect(s.note, `step ${s.step}`).toMatch(/SIMULATED|simulated/);
  });

  it('level 5 wording follows "Verified (simulated): ..." and level 1 to 3 wording follows its template', () => {
    for (const cl of c.claims) {
      for (const v of cl.versions) {
        if (v.level === 1) expect(v.statement).toMatch(/^Observed in /);
        if (v.level === 2) expect(v.statement).toMatch(/^Analytical indicator I-\d+: .* This is an ordering, not a probability\.$/);
        if (v.level === 3) expect(v.statement).toMatch(/^Correlated evidence: /);
      }
    }
    for (const h of c.hypotheses) {
      for (const v of h.versions) {
        if (v.level === 5) expect(v.statement).toMatch(/^Verified \(simulated\): /);
        if (v.level === 4) expect(v.statement).toMatch(/^Hypothesis H-\w+-?\w*, .*Not established\.$/);
        if (v.level === null) expect(v.statement).toMatch(/no longer holds/);
      }
    }
  });
});

describe('files and sources of this build', () => {
  it('every file carries simulated: true', () => {
    expect(truth.simulated).toBe(true);
    expect(manifest.simulated).toBe(true);
    for (const id of CASE_IDS) expect(cases[id].simulated).toBe(true);
  });

  it('seed and test sources contain no em dash and no en dash', () => {
    for (const dir of ['server/seed', 'tests']) {
      for (const name of readdirSync(dir)) {
        if (!name.endsWith('.ts')) continue;
        expect(readFileSync(join(dir, name), 'utf8'), `${dir}/${name}`).not.toMatch(DASHES);
      }
    }
  });
});
