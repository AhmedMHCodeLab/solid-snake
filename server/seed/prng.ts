// Seeded PRNG and small numeric helpers. Nothing in seed/ reads the wall clock or unseeded randomness.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a label, mixed with the seed, so each case and each purpose gets its own stream. */
export function subSeed(seed: number, label: string): number {
  let h = (2166136261 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  private f: () => number;
  constructor(seed: number) {
    this.f = mulberry32(seed);
  }
  next(): number {
    return this.f();
  }
  /** Inclusive integer range. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(a: readonly T[]): T {
    return a[Math.floor(this.next() * a.length)] as T;
  }
  exp(mean: number): number {
    return -Math.log(1 - this.next()) * mean;
  }
  normal(): number {
    const u = 1 - this.next();
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  poisson(mean: number): number {
    const l = Math.exp(-mean);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l);
    return k - 1;
  }
  weighted(weights: readonly number[]): number {
    const total = weights.reduce((s, w) => s + w, 0);
    let x = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      x -= weights[i] as number;
      if (x < 0) return i;
    }
    return weights.length - 1;
  }
  shuffle<T>(a: readonly T[]): T[] {
    const out = a.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = out[i] as T;
      out[i] = out[j] as T;
      out[j] = t;
    }
    return out;
  }
}

/** Fixed-precision rounding that never returns -0. */
export function r(n: number, dp: number): number {
  const f = 10 ** dp;
  const v = Math.round(n * f) / f;
  return v === 0 ? 0 : v;
}

export const pad = (n: number, w: number): string => String(n).padStart(w, '0');
