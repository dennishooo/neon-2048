import { createRng, type Rng } from "./rng";
import type { Direction, GameState, MoveResult, Tile, TileId } from "./types";

export const DEFAULT_SIZE = 4;
export const WIN_VALUE = 2048;
const SPAWN_FOUR_PROB = 0.1;

let nextId = 1;
function newId(): TileId {
  return nextId++;
}

/** Internal: snapshot used to detect "did anything change". Cheap and exact. */
function tilesFingerprint(tiles: Tile[]): string {
  const sorted = [...tiles].sort((a, b) =>
    a.row !== b.row ? a.row - b.row : a.col - b.col,
  );
  return sorted.map((t) => `${t.row},${t.col},${t.value}`).join("|");
}

function emptyCells(state: GameState): Array<{ row: number; col: number }> {
  const occupied = new Set<number>();
  for (const t of state.tiles) occupied.add(t.row * state.size + t.col);
  const cells: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      if (!occupied.has(r * state.size + c)) cells.push({ row: r, col: c });
    }
  }
  return cells;
}

export interface CreateGameOpts {
  size?: number;
  best?: number;
  seed?: number;
}

export function createGame(opts: CreateGameOpts = {}): {
  state: GameState;
  rng: Rng;
} {
  const size = opts.size ?? DEFAULT_SIZE;
  const rng = createRng(opts.seed);
  let state: GameState = {
    size,
    tiles: [],
    score: 0,
    best: opts.best ?? 0,
    highest: 0,
    won: false,
    over: false,
    moves: 0,
  };
  state = spawnTile(state, rng) ?? state;
  state = spawnTile(state, rng) ?? state;
  return { state, rng };
}

export function spawnTile(state: GameState, rng: Rng): GameState | null {
  const empties = emptyCells(state);
  if (empties.length === 0) return null;
  const cell = empties[rng.int(empties.length)]!;
  const value = rng.next() < SPAWN_FOUR_PROB ? 4 : 2;
  const tile: Tile = {
    id: newId(),
    row: cell.row,
    col: cell.col,
    value,
    fresh: true,
  };
  return {
    ...state,
    tiles: [...state.tiles, tile],
    highest: Math.max(state.highest, value),
  };
}

/**
 * Build a 2D grid of tile references for the current state. Cells without
 * tiles are null.
 */
function gridOf(state: GameState): Array<Array<Tile | null>> {
  const g: Array<Array<Tile | null>> = Array.from({ length: state.size }, () =>
    Array<Tile | null>(state.size).fill(null),
  );
  for (const t of state.tiles) g[t.row]![t.col] = t;
  return g;
}

/** Slide+merge a single line toward index 0. Mutates `line`. Returns gained points. */
function collapseLine(line: Array<Tile | null>): {
  next: Array<Tile | null>;
  gained: number;
  merges: Array<{ keptId: TileId; eatenId: TileId; newValue: number }>;
} {
  const compact: Tile[] = line.filter((t): t is Tile => t !== null);
  const out: Array<Tile | null> = Array(line.length).fill(null);
  const merges: Array<{ keptId: TileId; eatenId: TileId; newValue: number }> = [];
  let i = 0;
  let writeIdx = 0;
  let gained = 0;
  while (i < compact.length) {
    const a = compact[i]!;
    const b = compact[i + 1];
    if (b && b.value === a.value) {
      const newValue = a.value * 2;
      // Place "a" as the surviving tile, with merge metadata so the renderer
      // can show "b" sliding into "a" then pulsing.
      out[writeIdx] = {
        ...a,
        value: newValue,
        mergedFrom: [a.id, b.id],
        fresh: false,
      };
      merges.push({ keptId: a.id, eatenId: b.id, newValue });
      gained += newValue;
      i += 2;
    } else {
      out[writeIdx] = { ...a, mergedFrom: undefined, fresh: false };
      i += 1;
    }
    writeIdx += 1;
  }
  return { next: out, gained, merges };
}

/** Read out the row/column for a given (line index, position-along-line) under a given direction. */
function coordFor(
  dir: Direction,
  lineIdx: number,
  pos: number,
  size: number,
): { row: number; col: number } {
  switch (dir) {
    case "left":
      return { row: lineIdx, col: pos };
    case "right":
      return { row: lineIdx, col: size - 1 - pos };
    case "up":
      return { row: pos, col: lineIdx };
    case "down":
      return { row: size - 1 - pos, col: lineIdx };
  }
}

/** Read the line that should "slide toward 0" for a given direction. */
function readLine(
  grid: Array<Array<Tile | null>>,
  dir: Direction,
  lineIdx: number,
): Array<Tile | null> {
  const size = grid.length;
  const line: Array<Tile | null> = Array(size).fill(null);
  for (let pos = 0; pos < size; pos++) {
    const { row, col } = coordFor(dir, lineIdx, pos, size);
    line[pos] = grid[row]![col];
  }
  return line;
}

export function move(
  state: GameState,
  dir: Direction,
  rng: Rng,
): MoveResult {
  if (state.over) {
    return { state, changed: false, gained: 0, justWon: false };
  }
  const size = state.size;
  const grid = gridOf(state);
  const newTiles: Tile[] = [];
  let gained = 0;

  for (let lineIdx = 0; lineIdx < size; lineIdx++) {
    const line = readLine(grid, dir, lineIdx);
    const { next, gained: g } = collapseLine(line);
    gained += g;
    for (let pos = 0; pos < size; pos++) {
      const t = next[pos];
      if (!t) continue;
      const { row, col } = coordFor(dir, lineIdx, pos, size);
      newTiles.push({ ...t, row, col });
    }
  }

  // Detect change by comparing position+value fingerprints.
  const before = tilesFingerprint(state.tiles);
  const after = tilesFingerprint(newTiles);
  if (before === after) {
    return { state, changed: false, gained: 0, justWon: false };
  }

  const highest = newTiles.reduce((m, t) => Math.max(m, t.value), 0);
  const wonNow = !state.won && highest >= WIN_VALUE;
  const score = state.score + gained;
  let nextState: GameState = {
    ...state,
    tiles: newTiles,
    score,
    best: Math.max(state.best, score),
    highest,
    won: state.won || wonNow,
    moves: state.moves + 1,
  };

  let spawnedId: TileId | undefined;
  const afterSpawn = spawnTile(nextState, rng);
  if (afterSpawn) {
    nextState = afterSpawn;
    spawnedId = afterSpawn.tiles[afterSpawn.tiles.length - 1]!.id;
  }

  nextState.over = !hasMovesAvailable(nextState);

  return {
    state: nextState,
    changed: true,
    gained,
    spawnedId,
    justWon: wonNow,
  };
}

export function hasMovesAvailable(state: GameState): boolean {
  if (state.tiles.length < state.size * state.size) return true;
  const grid = gridOf(state);
  for (let r = 0; r < state.size; r++) {
    for (let c = 0; c < state.size; c++) {
      const t = grid[r]![c]!;
      const right = c + 1 < state.size ? grid[r]![c + 1] : null;
      const down = r + 1 < state.size ? grid[r + 1]![c] : null;
      if (right && right.value === t.value) return true;
      if (down && down.value === t.value) return true;
    }
  }
  return false;
}

/** Pure factory for tests: build a state from a value grid (0 = empty). */
export function stateFromGrid(
  values: number[][],
  opts: { score?: number; won?: boolean; best?: number } = {},
): GameState {
  const size = values.length;
  const tiles: Tile[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const v = values[r]![c]!;
      if (v > 0) {
        tiles.push({ id: newId(), row: r, col: c, value: v });
      }
    }
  }
  const highest = tiles.reduce((m, t) => Math.max(m, t.value), 0);
  return {
    size,
    tiles,
    score: opts.score ?? 0,
    best: opts.best ?? 0,
    highest,
    won: opts.won ?? false,
    over: false,
    moves: 0,
  };
}

export function gridValues(state: GameState): number[][] {
  const out: number[][] = Array.from({ length: state.size }, () =>
    Array<number>(state.size).fill(0),
  );
  for (const t of state.tiles) out[t.row]![t.col] = t.value;
  return out;
}
