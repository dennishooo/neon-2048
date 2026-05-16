const BEST_KEY = "neon-2048.best";

export function loadBest(): number {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBest(value: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    /* private mode / quota — ignore */
  }
}
