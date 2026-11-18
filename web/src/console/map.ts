// The persistent map. One SVG, two plates stacked in depth. Geometry is a function of a few parameters (cameras,
// descent, area interpolation, light); tweens drive the parameters, render() draws them. Hand pan and zoom compose on
// top of the stage camera and reset when the case state changes. No point markers except the verified-site mark.
import gsap from 'gsap';
import type { MapShape } from '../../../shared/types';
import { DURATION, EASE } from '../ui/motion';
import { bbox, centre, clamp, fit, lerpPts, lerpRect, pad, pathOf, seg, shapeWorld, type Rect, type XY } from '../render/geometry';
import { entryStatus, mapStateAt, shapeById, type Model } from '../render/model';
import { areaClass, caseLayer, caseWorld, LAND, mapShellSVG, spotOf, stateCamera } from '../render/plate';
import { esc, handling, levelText } from '../render/util';

const KIND_NAME: Record<MapShape['kind'], string> = {
  region: 'Broad region', sector: 'Cell area', 'observation-area': 'Observation area', band: 'Distance band', cluster: 'Activity cluster',
  footprint: 'Predicted footprint', 'verified-site': 'Verified site (exercise data)', seal: 'Sealed area', route: 'Route',
};
export const shapeName = (s: MapShape) => KIND_NAME[s.kind];

interface P { d: number; t: number; nat: Rect; cas: Rect; sn: XY; rn: number; sc: XY; rc: number; gain: number }
export interface AreaItem { id: string; name: string; entryId: string; level: string; derivation: string; evidence: string; label: string }

export class MapView {
  private el: HTMLElement;
  private svg!: SVGSVGElement;
  private tags!: HTMLElement;
  private cap!: HTMLElement;
  private p: P = { d: 0, t: 1, nat: pad(LAND, 0.05), cas: { x: 0, y: 0, w: 1200, h: 1200 }, sn: [400, 500], rn: 0, sc: [600, 600], rc: 0, gain: 1 };
  private u = { k: 1, x: 0, y: 0 };
  private from: XY[] | null = null;
  private to: XY[] | null = null;
  private model: Model | null = null;
  private step = -1;
  private regions: MapShape[] = [];
  /** Regions drawn on the national plate, each with the alerts that name it. Only queued alerts put a region on the plate. */
  private alertRegions = new Map<string, string[]>();
  private focusRegion: string | null = null;
  private reduce: () => boolean;
  onSelect: (item: AreaItem | null) => void = () => {};

  constructor(el: HTMLElement, reduce: () => boolean) {
    this.el = el;
    this.reduce = reduce;
  }

  mount(regions: MapShape[]) {
    this.regions = regions;
    this.el.innerHTML = `${mapShellSVG(regions)}<div class="cmap__tags" aria-hidden="true"></div>${handling('plate')}`;
    this.svg = this.el.querySelector('svg')!;
    this.tags = this.el.querySelector('.cmap__tags')!;
    this.cap = document.getElementById('mapcap')!;
    new ResizeObserver(() => this.render()).observe(this.el);
    this.bindInput();
    this.render();
  }

  /** Region geometry arrives with case views; the national plate learns each region once. */
  addRegion(r: MapShape) {
    if (this.regions.some((x) => x.id === r.id)) return;
    this.regions.push(r);
    const veil = this.svg.querySelector('.cmap__nat > g:last-of-type');
    const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tmp.innerHTML = mapShellSVG([r]).replace(/^[\s\S]*?<g class="cmap__nat"[^>]*>/, '').match(/<g class="area[\s\S]*?<\/g>/)?.[0] ?? '';
    const g = tmp.firstElementChild;
    if (g && veil) veil.before(g);
  }

  /** Replace the set of alert regions on the national plate. Geometry must already be known (addRegion). */
  setAlertRegions(list: { shapeId: string; alertId: string }[]) {
    this.alertRegions = new Map();
    for (const a of list) this.alertRegions.set(a.shapeId, [...(this.alertRegions.get(a.shapeId) ?? []), a.alertId]);
  }
  hasRegion(id: string) { return this.regions.some((r) => r.id === id); }
  drawnRegions(): string[] { return [...this.alertRegions.keys()]; }

  // ---- modes -----------------------------------------------------------------------------------------------------
  /** National plate with each queued alert's region. The light falls on the region in focus, if any. */
  monitor(focus: string | null, animate: boolean) {
    const changedFocus = focus !== this.focusRegion;
    this.focusRegion = focus;
    if (this.model) { this.model = null; this.step = -1; this.svg.querySelector('.cmap__case')!.innerHTML = ''; this.to = this.from = null; }
    const target: Partial<P> = { d: 0, nat: pad(LAND, 0.05) };
    const r = this.regions.find((x) => x.id === focus);
    // With nothing in focus the whole plate is under the light; with an alert in focus, its region is.
    if (r) { const b = bbox(shapeWorld(r)); target.sn = centre(b); target.rn = Math.max(b.w, b.h) * 0.75 + 16; } else { target.sn = centre(LAND); target.rn = 900; }
    this.go(target, animate && (changedFocus || this.p.d > 0), DURATION.standard, EASE.travel);
  }

  /** Open a case: build its plate and descend from the national plate (region) to the case plate. */
  openCase(m: Model, step: number, animate: boolean) {
    this.model = m;
    this.step = step;
    this.svg.querySelector('.cmap__case')!.innerHTML = caseLayer(m);
    const st = mapStateAt(m, step);
    const area = shapeById(m, st?.area?.shapeId);
    this.to = this.from = area && area.plate === 'case' ? shapeWorld(area) : null;
    const regionShape = m.map.region ? shapeById(m, m.map.region.shapeId) : undefined;
    const rb = regionShape ? bbox(shapeWorld(regionShape)) : null;
    this.focusRegion = regionShape?.id ?? null;
    if (rb) { this.p.sn = centre(rb); this.p.rn = Math.max(rb.w, rb.h) * 0.75 + 16; }
    const spot = spotOf(m, st);
    const caseState = st?.plate === 'case';
    const target: Partial<P> = { cas: stateCamera(m, st), sc: spot.c, rc: caseState ? spot.r : 0, d: caseState ? 1 : 0, t: 1 };
    if (!caseState) target.nat = pad(LAND, 0.05);
    if (caseState && animate && !this.reduce() && this.p.d < 1) {
      this.p.cas = target.cas!; this.p.sc = target.sc!; this.p.rc = target.rc!;
      this.p.d = 0;
      this.render();
      gsap.to(this.p, { d: 1, duration: DURATION.long * 1.6, ease: EASE.travel, onUpdate: () => this.render() });
      return;
    }
    this.go(target, false);
  }

  /** A new released state of the open case. Animates the area and camera when asked; otherwise sets them. */
  caseStep(m: Model, step: number, animate: boolean) {
    const prev = this.model && this.model.id === m.id ? mapStateAt(this.model, this.step) : undefined;
    // The server releases shapes step by step: rebuild the plate's contents when new ones arrive.
    const had = new Set(this.model?.map.shapes.map((s) => s.id) ?? []);
    // The seal can also be withdrawn (a promotion that is not countersigned), so a shape set that shrinks rebuilds it too.
    if (m.map.shapes.length !== had.size || m.map.shapes.some((s) => !had.has(s.id))) this.svg.querySelector('.cmap__case')!.innerHTML = caseLayer(m);
    this.model = m;
    const st = mapStateAt(m, step);
    this.step = step;
    if (!st) return;
    const area = shapeById(m, st.area?.shapeId);
    const pts = area && area.plate === 'case' ? shapeWorld(area) : null;
    const curPts = this.currentArea();
    const spot = spotOf(m, st);
    const caseState = st.plate === 'case';
    this.u = { k: 1, x: 0, y: 0 };
    const plateChange = prev && prev.plate !== st.plate;
    if (plateChange && caseState) { this.openCase(m, step, animate); return; }
    this.from = curPts ?? pts;
    this.to = pts;
    const target: Partial<P> = { t: 1, cas: stateCamera(m, st), sc: spot.c, rc: caseState ? spot.r : 0, d: caseState ? 1 : 0 };
    if (!caseState) { const r = shapeById(m, st.spotlightShapeId); if (r) { const b = bbox(shapeWorld(r)); target.sn = centre(b); target.rn = Math.max(b.w, b.h) * 0.75 + 16; } }
    this.p.t = 0;
    this.go(target, animate, DURATION.long, EASE.draw);
  }

  private currentArea(): XY[] | null {
    if (!this.to) return null;
    return this.from ? lerpPts(this.from, this.to, this.p.t) : this.to;
  }
  private anim = { e: 1 };
  /** One scalar progress drives every parameter: rects interpolate as cameras, points and numbers linearly. */
  private go(target: Partial<P>, animate: boolean, duration: number = DURATION.standard, ease: string = EASE.travel) {
    gsap.killTweensOf(this.anim);
    const from: P = { ...this.p, nat: { ...this.p.nat }, cas: { ...this.p.cas }, sn: [...this.p.sn], sc: [...this.p.sc] };
    const apply = (e: number) => {
      const p = this.p as unknown as Record<string, unknown>;
      for (const [k, to] of Object.entries(target)) {
        const a = (from as unknown as Record<string, unknown>)[k];
        if (typeof to === 'number') p[k] = (a as number) + (to - (a as number)) * e;
        else if (Array.isArray(to)) p[k] = [(a as XY)[0] + (to[0] - (a as XY)[0]) * e, (a as XY)[1] + (to[1] - (a as XY)[1]) * e];
        else if (to && typeof to === 'object') p[k] = lerpRect(a as Rect, to as Rect, e);
      }
      this.render();
    };
    if (!animate || this.reduce()) { apply(1); this.p.t = 1; this.render(); return; }
    this.anim.e = 0;
    gsap.to(this.anim, { e: 1, duration, ease, onUpdate: () => apply(this.anim.e) });
  }

  // ---- rendering -------------------------------------------------------------------------------------------------
  private screen(): Rect {
    const r = this.el.getBoundingClientRect();
    const narrow = r.width < 560;
    const pl = narrow ? 12 : 32, pr = narrow ? 12 : 32, pt = narrow ? 34 : 48, pb = narrow ? 36 : 56;
    return { x: pl, y: pt, w: Math.max(40, r.width - pl - pr), h: Math.max(40, r.height - pt - pb) };
  }
  private layer(g: SVGGElement, f: { k: number; tx: number; ty: number }) {
    const k = f.k * this.u.k, tx = f.tx * this.u.k + this.u.x, ty = f.ty * this.u.k + this.u.y;
    g.setAttribute('transform', `matrix(${k} 0 0 ${k} ${tx} ${ty})`);
    return { k, tx, ty };
  }
  private hatch(prefix: string, k: number) {
    this.svg.querySelectorAll<SVGPatternElement>(`pattern[id^="${prefix}-"]`).forEach((pt) => pt.setAttribute('patternTransform', `rotate(${pt.dataset.rot}) scale(${(1 / k).toFixed(4)})`));
  }

  render() {
    if (!this.svg) return;
    const box = this.el.getBoundingClientRect();
    this.svg.setAttribute('viewBox', `0 0 ${Math.max(1, box.width)} ${Math.max(1, box.height)}`);
    const S = this.screen();
    const p = this.p;
    const m = this.model;
    const natG = this.svg.querySelector<SVGGElement>('.cmap__nat')!;
    const caseG = this.svg.querySelector<SVGGElement>('.cmap__case')!;
    const recede = this.svg.querySelector<SVGRectElement>('.cmap__recede')!;

    // National camera: into the region as the descent begins.
    const region = m?.map.region ? shapeById(m, m.map.region.shapeId) : this.regions.find((r) => r.id === this.focusRegion);
    const regionCam = region ? pad(bbox(shapeWorld(region)), 0.25) : p.nat;
    const natCam = lerpRect(p.nat, regionCam, seg(p.d, 0, 0.7));
    const nf = this.layer(natG, fit(natCam, S));
    this.hatch('mn', nf.k);
    natG.querySelector('[data-shadow]')?.setAttribute('transform', `translate(${5 / nf.k} ${8 / nf.k})`);
    const sn = this.svg.querySelectorAll('#mveil-n circle');
    sn.forEach((c, i) => { c.setAttribute('cx', String(p.sn[0])); c.setAttribute('cy', String(p.sn[1])); c.setAttribute('r', String(p.rn * p.gain * (i === 0 ? 1.22 : 1))); });
    recede.setAttribute('width', String(box.width + 20));
    recede.setAttribute('height', String(box.height + 20));
    recede.setAttribute('opacity', (seg(p.d, 0.3, 1) * 0.72).toFixed(3));

    // Regions on the national plate.
    for (const r of this.regions) {
      const g = natG.querySelector<SVGGElement>(`[data-shape="${CSS.escape(r.id)}"]`);
      if (!g) continue;
      const on = m ? r.id === m.map.region?.shapeId : this.alertRegions.has(r.id);
      g.toggleAttribute('hidden', !on);
      g.classList.toggle('is-focus', r.id === this.focusRegion);
    }

    // Case plate: rises out of the region as d goes to 1.
    const showCase = !!m && p.d > 0.22;
    caseG.setAttribute('visibility', showCase ? 'visible' : 'hidden');
    let cf = { k: 1, tx: 0, ty: 0 };
    if (m && showCase) {
      const W = caseWorld(m);
      const final = fit(p.cas, S);
      const finalRect: Rect = { x: final.tx, y: final.ty, w: W.w * final.k, h: W.h * final.k };
      const rb = region ? bbox(shapeWorld(region)) : null;
      const startRect: Rect = rb ? { x: nf.tx + rb.x * nf.k, y: nf.ty + rb.y * nf.k, w: rb.w * nf.k, h: rb.h * nf.k } : finalRect;
      const e = seg(p.d, 0.22, 1);
      const r = lerpRect(startRect, finalRect, e);
      cf = this.layer(caseG, { k: r.w / W.w, tx: r.x, ty: r.y });
      this.hatch('mc', cf.k);
      caseG.querySelector('[data-shadow]')?.setAttribute('transform', `translate(${(4 + 12 * e) / cf.k} ${(6 + 18 * e) / cf.k})`);
      this.svg.querySelectorAll('#mveil-c circle').forEach((c, i) => { c.setAttribute('cx', String(p.sc[0])); c.setAttribute('cy', String(p.sc[1])); c.setAttribute('r', String(p.rc * p.gain * (i === 0 ? 1.22 : 1))); });
      this.drawCase(m, cf.k);
    }
    this.drawTags(nf, cf);
  }

  private drawCase(m: Model, k: number) {
    const st = mapStateAt(m, this.step);
    if (!st) return;
    const caseG = this.svg.querySelector<SVGGElement>('.cmap__case')!;
    const areaG = caseG.querySelector<SVGGElement>('[data-shape="area"]');
    const pts = this.currentArea();
    const area = shapeById(m, st.area?.shapeId);
    if (areaG) {
      const d = pts ? pathOf(pts) : '';
      areaG.setAttribute('class', `${areaClass(area)}${st.spotlightShapeId === area?.id ? ' is-lit' : ''}`);
      areaG.dataset.select = area?.id ?? '';
      const pat = area?.kind === 'observation-area' ? 'obs' : area?.kind === 'band' ? 'band' : 'sector';
      areaG.querySelectorAll('path').forEach((pa) => pa.setAttribute('d', d));
      areaG.querySelector('.area__fill')?.setAttribute('fill', `url(#mc-${pat})`);
    }
    const styles = new Map(st.shapes.map((s) => [s.shapeId, s.style]));
    caseG.querySelectorAll<SVGElement>('[data-shape]').forEach((el) => {
      const id = el.dataset.shape!;
      if (id === 'area') return;
      const s = styles.get(id);
      el.toggleAttribute('hidden', !s || (s === 'dissolved' && !el.classList.contains('is-dissolving')));
      if (el.classList.contains('history')) el.toggleAttribute('hidden', s !== 'history');
      if (el.classList.contains('footprint')) { el.classList.toggle('footprint--solid', s === 'solid'); el.classList.toggle('footprint--dashed', s === 'dashed'); }
      if (el.classList.contains('site')) {
        const c = centre(bbox(shapeWorld(shapeById(m, id)!)));
        el.setAttribute('transform', `translate(${c[0]} ${c[1]}) scale(${(1 / k).toFixed(4)})`);
      }
    });
  }

  private drawTags(nf: { k: number; tx: number; ty: number }, cf: { k: number; tx: number; ty: number }) {
    const out: string[] = [];
    const at = (w: XY, f: { k: number; tx: number; ty: number }) => [w[0] * f.k + f.tx, w[1] * f.k + f.ty];
    const box = this.el.getBoundingClientRect();
    const taken: [number, number][] = [];
    /** xy is the anchor on the shape's right edge; past the middle the tag flips to the left edge (lx) so it never covers the shape.
     *  The final position is set after measuring (see below), so a label can never leave the map frame. */
    const place = (xy: number[], html: string, cls = '', lx?: number) => {
      const flip = xy[0]! > box.width * 0.5 && lx !== undefined;
      const x = clamp(flip ? lx! : xy[0]!, 8, box.width - 8);
      let y = clamp(xy[1]!, 8, box.height - 30);
      // labels never sit on each other: step down past any tag already placed near this one
      while (taken.some(([tx, ty]) => Math.abs(tx - x) < 190 && Math.abs(ty - y) < 34)) y += 36;
      taken.push([x, y]);
      out.push(`<span class="cmap__tag ${cls}" data-x="${x.toFixed(0)}" data-y="${y.toFixed(0)}" data-end="${flip || x > box.width * 0.62 ? 1 : 0}">${html}</span>`);
    };
    const m = this.model;
    if (!m || this.p.d < 0.5) {
      for (const r of this.regions) {
        const on = m ? r.id === m.map.region?.shapeId : this.alertRegions.has(r.id);
        if (!on) continue;
        const b = bbox(shapeWorld(r));
        const ids = this.alertRegions.get(r.id);
        place(at([b.x + b.w, b.y + b.h / 2], nf), `${esc(r.label.split(':')[0] ?? 'Region')}<b>${!m && ids ? `${esc(ids.join(', '))} &middot; area of stated uncertainty` : 'Not a position'}</b>`, r.id === this.focusRegion ? 'is-focus' : '');
      }
    } else if (m) {
      for (const it of this.areaItems()) {
        const sh = shapeById(m, it.id)!;
        const b = bbox(shapeWorld(sh));
        const xy = at([b.x + b.w, b.y], cf);
        const left = at([b.x, b.y], cf)[0];
        place(xy,`${esc(it.name)}${sh.kind === 'verified-site' ? '' : sh.kind === 'footprint' ? '' : ' &middot; not a position'}<b>${esc(it.entryId)} &middot; ${esc(it.level)}</b>`, '', left);
      }
    }
    this.tags.innerHTML = out.join('');
    // Clamp every label inside the frame: the anchor decides the side, the measured size decides the position.
    for (const el of this.tags.querySelectorAll<HTMLElement>('.cmap__tag')) {
      const w = el.offsetWidth, h = el.offsetHeight, x = Number(el.dataset.x), y = Number(el.dataset.y);
      const left = clamp(el.dataset.end === '1' ? x - w - 8 : x + 8, 6, Math.max(6, box.width - w - 6));
      const top = clamp(y + 4, 6, Math.max(6, box.height - h - 6));
      el.style.transform = `translate(${left.toFixed(0)}px,${top.toFixed(0)}px)`;
    }
    this.caption();
  }

  private caption() {
    if (!this.cap) return;
    const m = this.model;
    if (!m) {
      this.cap.innerHTML = `<p class="mapcap__k">National plate</p><p class="mapcap__t">Qatar outline. Hatched areas are broad regions where ingested records of interest were associated, never positions.</p>`;
      return;
    }
    const st = mapStateAt(m, this.step);
    const area = shapeById(m, st?.area?.shapeId);
    const it = area ? this.itemOf(area) : null;
    this.cap.innerHTML = `<p class="mapcap__k">${st?.plate === 'case' ? 'Now viewing: case plate, local grid' : 'National plate'}</p>
      ${it ? `<p class="mapcap__t"><b>${esc(it.name)}</b> &middot; ${esc(it.entryId)} &middot; ${esc(it.level)}</p><p class="mapcap__d">${esc(it.derivation)}</p>` : `<p class="mapcap__t">No geographic claim available.</p>`}
      ${st?.plate === 'case' ? '<p class="mapcap__d">Positions on this plate are on a local grid and do not correspond to real places.</p>' : ''}`;
  }

  // ---- areas, selection ------------------------------------------------------------------------------------------
  private itemOf(sh: MapShape): AreaItem {
    const m = this.model!;
    const e = m.entries.find((x) => x.id === sh.boundTo);
    const s = e ? entryStatus(e, this.step) : null;
    const level = s?.kind === 'current' ? levelText(s.level) : s?.kind === 'fallen' ? `No longer holds, was ${s.was}` : 'No level yet';
    const ev = s && s.kind !== 'absent' ? s.version.evidence.join(', ') + (s.version.evidenceCount > s.version.evidence.length ? ` and ${s.version.evidenceCount - s.version.evidence.length} more` : '') : '';
    return { id: sh.id, name: shapeName(sh), entryId: sh.boundTo, level, derivation: sh.derivation, evidence: ev, label: sh.label };
  }
  areaItems(): AreaItem[] {
    const m = this.model;
    if (!m) return this.regions.filter((r) => this.alertRegions.has(r.id)).map((r) => ({ id: r.id, name: shapeName(r), entryId: (this.alertRegions.get(r.id) ?? []).join(', '), level: 'Area of stated uncertainty', derivation: r.derivation, evidence: '', label: r.label }));
    const st = mapStateAt(m, this.step);
    if (!st) return [];
    const ids = [st.area?.shapeId, ...st.shapes.filter((s) => s.style !== 'dissolved' && s.style !== 'history').map((s) => s.shapeId)].filter((x): x is string => !!x);
    return [...new Set(ids)].map((id) => shapeById(m, id)).filter((s): s is MapShape => !!s && s.kind !== 'seal').map((s) => this.itemOf(s));
  }
  select(id: string) {
    const item = this.areaItems().find((a) => a.id === id) ?? null;
    this.svg.querySelectorAll('.is-selected').forEach((e) => e.classList.remove('is-selected'));
    if (item) this.svg.querySelector(`[data-select="${CSS.escape(id)}"]`)?.classList.add('is-selected');
    this.onSelect(item);
  }

  // ---- hand pan and zoom: instant ---------------------------------------------------------------------------------
  zoom(f: number, cx?: number, cy?: number) {
    const S = this.screen();
    const items = this.areaItems();
    let smallest = Infinity;
    const m = this.model;
    for (const it of items) {
      const sh = m ? shapeById(m, it.id) : this.regions.find((r) => r.id === it.id);
      if (!sh || sh.kind === 'verified-site') continue;
      const b = bbox(shapeWorld(sh));
      const f0 = sh.plate === 'case' ? fit(this.p.cas, S).k : fit(this.p.nat, S).k;
      smallest = Math.min(smallest, Math.max(b.w, b.h) * f0);
    }
    const ceil = Number.isFinite(smallest) ? Math.max(1, Math.min(S.w, S.h) / smallest) : 4;
    const k = clamp(this.u.k * f, 0.7, ceil);
    const px = cx ?? S.x + S.w / 2, py = cy ?? S.y + S.h / 2;
    this.u.x = px - ((px - this.u.x) * k) / this.u.k;
    this.u.y = py - ((py - this.u.y) * k) / this.u.k;
    this.u.k = k;
    this.render();
  }
  pan(dx: number, dy: number) { this.u.x += dx; this.u.y += dy; this.render(); }
  resetView() { this.u = { k: 1, x: 0, y: 0 }; this.render(); }

  private bindInput() {
    const ptrs = new Map<number, { x: number; y: number }>();
    let moved = 0;
    let pinch = 0;
    this.svg.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (e.pointerType === 'mouse') this.svg.setPointerCapture(e.pointerId); });
    this.svg.addEventListener('pointermove', (e) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const before = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        ptrs.set(e.pointerId, cur);
        const [c, d] = [...ptrs.values()];
        const after = Math.hypot(c!.x - d!.x, c!.y - d!.y);
        const r = this.el.getBoundingClientRect();
        if (before > 0) this.zoom(after / before, (c!.x + d!.x) / 2 - r.left, (c!.y + d!.y) / 2 - r.top);
        pinch = 1;
        return;
      }
      moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
      ptrs.set(e.pointerId, cur);
      if (e.pointerType === 'mouse' && e.buttons !== 1) return;
      this.pan(cur.x - prev.x, cur.y - prev.y);
    });
    const end = (e: PointerEvent) => {
      const wasClick = ptrs.size === 1 && moved < 5 && !pinch;
      ptrs.delete(e.pointerId);
      if (!ptrs.size) pinch = 0;
      if (wasClick && e.type === 'pointerup') {
        const t = (e.target as Element).closest<SVGElement>('[data-select]');
        if (t?.dataset.select) this.select(t.dataset.select);
      }
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', end);
    this.svg.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return; // the page scroll is never captured
      e.preventDefault();
      const r = this.el.getBoundingClientRect();
      this.zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }
  key(e: KeyboardEvent): boolean {
    const step = 40;
    switch (e.key) {
      case '+': case '=': this.zoom(1.25); return true;
      case '-': case '_': this.zoom(1 / 1.25); return true;
      case '0': this.resetView(); return true;
      case 'ArrowLeft': this.pan(step, 0); return true;
      case 'ArrowRight': this.pan(-step, 0); return true;
      case 'ArrowUp': this.pan(0, step); return true;
      case 'ArrowDown': this.pan(0, -step); return true;
    }
    return false;
  }

  // ---- choreography hooks ------------------------------------------------------------------------------------------
  /** The verified moment: the surviving footprint is inked solid, the rivals dissolve, the survey mark is drawn. */
  test(survivor: string | undefined, fallen: string[]) {
    if (this.reduce()) return;
    const caseG = this.svg.querySelector('.cmap__case')!;
    const ink = survivor ? caseG.querySelector<SVGPathElement>(`[data-shape="${CSS.escape(survivor)}"] .footprint__ink`) : null;
    if (ink) {
      const len = ink.getTotalLength() * 1.02;
      gsap.fromTo(ink, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: DURATION.long, ease: EASE.draw, onComplete: () => { ink.style.strokeDasharray = ''; ink.style.strokeDashoffset = ''; } });
    }
    for (const id of fallen) {
      const g = caseG.querySelector<SVGGElement>(`[data-shape="${CSS.escape(id)}"]`);
      if (!g) continue;
      g.classList.add('is-dissolving');
      g.removeAttribute('hidden');
      gsap.fromTo(g, { opacity: 1 }, { opacity: 0, duration: DURATION.long, ease: EASE.settle, onComplete: () => { g.classList.remove('is-dissolving'); g.style.opacity = ''; this.render(); } });
    }
    const site = caseG.querySelector('.site');
    if (site) gsap.fromTo(site.querySelectorAll('.site__ring, .site__cross'), { opacity: 0 }, { opacity: 1, duration: DURATION.standard, ease: EASE.settle, delay: 0.5 });
  }
  /** The light comes up from nothing over the area in examination. */
  lightUp() {
    if (this.reduce()) return;
    gsap.fromTo(this.p, { gain: 0 }, { gain: 1, duration: DURATION.long, ease: EASE.settle, onUpdate: () => this.render() });
  }
}
