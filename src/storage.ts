import type { GameState, Tile } from "./engine/types";

const BEST_KEY = "neon-2048.best";
const GAME_KEY = "neon-2048.game";

/** Bump when the saved shape changes incompatibly. Old saves get discarded. */
const SCHEMA_VERSION = 1;

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

// ---------- Full game persistence ----------

export interface SavedGame {
  state: GameState;
  /** One previous state to support the single-step undo across sessions. */
  undo: GameState | null;
  /** Whether the win overlay has already been shown so we don't replay it on restore. */
  winShown: boolean;
}

interface Envelope {
  v: number;
  game: SavedGame;
}

/**
 * Strip render-only animation hints (mergedFrom, fresh) before saving — they
 * exist to drive a single frame of animation and would re-trigger a merge
 * pulse on first paint after restore.
 */
function sanitizeTile(t: Tile): Tile {
  return {
    id: t.id,
    value: t.value,
    row: t.row,
    col: t.col,
  };
}

function sanitizeState(s: GameState): GameState {
  return {
    size: s.size,
    tiles: s.tiles.map(sanitizeTile),
    score: s.score,
    best: s.best,
    highest: s.highest,
    won: s.won,
    over: s.over,
    moves: s.moves,
  };
}

export function saveGame(game: SavedGame): void {
  try {
    const envelope: Envelope = {
      v: SCHEMA_VERSION,
      game: {
        state: sanitizeState(game.state),
        undo: game.undo ? sanitizeState(game.undo) : null,
        winShown: game.winShown,
      },
    };
    localStorage.setItem(GAME_KEY, JSON.stringify(envelope));
  } catch {
    /* quota / serialization failure — drop the save silently */
  }
}

export type LoadResult =
  | { ok: true; game: SavedGame }
  | { ok: false; reason: "missing" | "corrupt" | "version" };

/**
 * Attempt to restore a saved game. Returns a discriminated result so the
 * caller can show a "restore failed" toast on corruption / version mismatch
 * (but not on first run, where there's just nothing to load).
 */
export function loadGame(): LoadResult {
  let raw: string | null;
  try {
    raw = localStorage.getItem(GAME_KEY);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (raw === null) return { ok: false, reason: "missing" };

  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "corrupt" };
  }
  if (!isEnvelope(envelope)) return { ok: false, reason: "corrupt" };
  if (envelope.v !== SCHEMA_VERSION) return { ok: false, reason: "version" };
  if (!isValidSavedGame(envelope.game)) return { ok: false, reason: "corrupt" };

  return { ok: true, game: envelope.game };
}

export function clearGame(): void {
  try {
    localStorage.removeItem(GAME_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- Validation ----------

function isEnvelope(x: unknown): x is Envelope {
  if (typeof x !== "object" || x === null) return false;
  const e = x as Record<string, unknown>;
  return typeof e.v === "number" && typeof e.game === "object" && e.game !== null;
}

function isValidSavedGame(x: unknown): x is SavedGame {
  if (typeof x !== "object" || x === null) return false;
  const g = x as Record<string, unknown>;
  if (typeof g.winShown !== "boolean") return false;
  if (!isValidState(g.state)) return false;
  if (g.undo !== null && !isValidState(g.undo)) return false;
  return true;
}

function isValidState(x: unknown): x is GameState {
  if (typeof x !== "object" || x === null) return false;
  const s = x as Record<string, unknown>;
  if (typeof s.size !== "number" || s.size < 2 || s.size > 12) return false;
  if (!Array.isArray(s.tiles)) return false;
  if (typeof s.score !== "number" || s.score < 0) return false;
  if (typeof s.best !== "number" || s.best < 0) return false;
  if (typeof s.highest !== "number" || s.highest < 0) return false;
  if (typeof s.won !== "boolean") return false;
  if (typeof s.over !== "boolean") return false;
  if (typeof s.moves !== "number" || s.moves < 0) return false;
  for (const t of s.tiles) {
    if (!isValidTile(t, s.size)) return false;
  }
  return true;
}

function isValidTile(x: unknown, size: number): x is Tile {
  if (typeof x !== "object" || x === null) return false;
  const t = x as Record<string, unknown>;
  if (typeof t.id !== "number") return false;
  if (typeof t.value !== "number" || t.value < 2) return false;
  // Power-of-two check — silently allow custom variants that still look sane.
  if ((t.value & (t.value - 1)) !== 0) return false;
  if (typeof t.row !== "number" || t.row < 0 || t.row >= size) return false;
  if (typeof t.col !== "number" || t.col < 0 || t.col >= size) return false;
  return true;
}
