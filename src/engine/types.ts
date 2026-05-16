export type Direction = "up" | "down" | "left" | "right";

/** Unique, monotonically-increasing tile id. Survives across moves so the renderer can tween. */
export type TileId = number;

export interface Tile {
  id: TileId;
  value: number;
  /** 0..size-1 */
  row: number;
  col: number;
  /** Set on the move that created this tile via merge. The renderer pulses it once. */
  mergedFrom?: [TileId, TileId];
  /** True the turn the tile spawned, for the spawn animation. */
  fresh?: boolean;
}

export interface GameState {
  size: number;
  tiles: Tile[];
  score: number;
  best: number;
  /** Highest tile reached this game. */
  highest: number;
  /** True once 2048 has been reached (player may choose to keep going). */
  won: boolean;
  /** True if no legal moves remain. */
  over: boolean;
  /** Move counter — useful for tests and debugging. */
  moves: number;
}

export interface MoveResult {
  state: GameState;
  /** Tiles that actually moved or merged this turn. */
  changed: boolean;
  /** Points gained this move (sum of merged tile values). */
  gained: number;
  /** Newly-spawned tile id, if any. */
  spawnedId?: TileId;
  /** Whether this move triggered the first 2048. */
  justWon: boolean;
}
