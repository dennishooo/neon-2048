/**
 * mulberry32 — tiny seedable RNG.
 *
 * Why: deterministic tests + reproducible spawns. The default unseeded
 * instance falls back to Math.random for normal play.
 */
export interface Rng {
  next(): number;
  int(maxExclusive: number): number;
}

export function createRng(seed?: number): Rng {
  if (seed === undefined) {
    return {
      next: Math.random,
      int: (n) => Math.floor(Math.random() * n),
    };
  }
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
  };
}
