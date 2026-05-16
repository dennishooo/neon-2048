import { describe, expect, it } from "vitest";
import {
  createGame,
  gridValues,
  hasMovesAvailable,
  move,
  stateFromGrid,
  WIN_VALUE,
} from "./game";
import { createRng } from "./rng";

describe("createGame", () => {
  it("starts with exactly two tiles", () => {
    const { state } = createGame({ seed: 1 });
    expect(state.tiles.length).toBe(2);
    expect(state.score).toBe(0);
    expect(state.over).toBe(false);
  });

  it("is deterministic when seeded", () => {
    const a = createGame({ seed: 42 }).state;
    const b = createGame({ seed: 42 }).state;
    expect(gridValues(a)).toEqual(gridValues(b));
  });
});

describe("move — slide & merge mechanics", () => {
  const rng = createRng(123);

  it("slides tiles left without merging unequal values", () => {
    const s = stateFromGrid([
      [2, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", rng);
    expect(res.changed).toBe(true);
    expect(res.state.tiles.find((t) => t.row === 0 && t.col === 0)?.value).toBe(2);
    expect(res.state.tiles.find((t) => t.row === 0 && t.col === 1)?.value).toBe(4);
  });

  it("merges two equal tiles and awards their sum", () => {
    const s = stateFromGrid([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", createRng(7));
    expect(res.gained).toBe(4);
    expect(res.state.score).toBe(4);
    const top = res.state.tiles.filter((t) => t.row === 0);
    const fourTile = top.find((t) => t.value === 4);
    expect(fourTile?.col).toBe(0);
  });

  it("merges only once per move (2,2,2,2 -> 4,4)", () => {
    const s = stateFromGrid([
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", createRng(11));
    // ignore the spawn — check the merged row only
    const row0 = res.state.tiles
      .filter((t) => t.row === 0)
      .sort((a, b) => a.col - b.col)
      .map((t) => ({ col: t.col, value: t.value }));
    expect(row0).toEqual([
      { col: 0, value: 4 },
      { col: 1, value: 4 },
    ]);
    expect(res.gained).toBe(8);
  });

  it("does not merge through a different tile (4,2,2 -> 4,4)", () => {
    const s = stateFromGrid([
      [4, 2, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", createRng(3));
    const row0 = res.state.tiles
      .filter((t) => t.row === 0)
      .sort((a, b) => a.col - b.col)
      .map((t) => t.value);
    expect(row0).toEqual([4, 4]);
  });

  it("right move is mirrored slide", () => {
    const s = stateFromGrid([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "right", createRng(5));
    const four = res.state.tiles.find((t) => t.value === 4);
    expect(four?.row).toBe(0);
    expect(four?.col).toBe(3);
  });

  it("up/down operate on columns", () => {
    const s = stateFromGrid([
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const up = move(s, "up", createRng(8));
    const four = up.state.tiles.find((t) => t.value === 4);
    expect(four?.row).toBe(0);
    expect(four?.col).toBe(0);

    const down = move(s, "down", createRng(8));
    const four2 = down.state.tiles.find((t) => t.value === 4);
    expect(four2?.row).toBe(3);
    expect(four2?.col).toBe(0);
  });

  it("returns changed=false and unchanged state when move is a no-op", () => {
    const s = stateFromGrid([
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", createRng(2));
    expect(res.changed).toBe(false);
    expect(res.gained).toBe(0);
    expect(res.state).toBe(s);
  });

  it("spawns a new tile on every successful move", () => {
    const s = stateFromGrid([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", createRng(99));
    expect(res.spawnedId).toBeDefined();
    expect(res.state.tiles.length).toBe(2); // 1 merged + 1 spawned
  });
});

describe("win / lose detection", () => {
  it("flags the first 2048 with justWon=true", () => {
    const s = stateFromGrid([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const res = move(s, "left", createRng(1));
    expect(res.justWon).toBe(true);
    expect(res.state.won).toBe(true);
    expect(res.state.highest).toBeGreaterThanOrEqual(WIN_VALUE);
  });

  it("only marks justWon=true once", () => {
    const s = stateFromGrid(
      [
        [1024, 1024, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      { won: true },
    );
    const res = move(s, "left", createRng(1));
    expect(res.justWon).toBe(false);
  });

  it("hasMovesAvailable=false on a full deadlocked board", () => {
    const s = stateFromGrid([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ]);
    expect(hasMovesAvailable(s)).toBe(false);
  });

  it("hasMovesAvailable=true when adjacent equal pair exists", () => {
    const s = stateFromGrid([
      [2, 2, 4, 8],
      [4, 16, 32, 64],
      [128, 256, 512, 4],
      [2, 8, 16, 32],
    ]);
    expect(hasMovesAvailable(s)).toBe(true);
  });
});

describe("score & best", () => {
  it("score accumulates and best tracks max", () => {
    let s = stateFromGrid(
      [
        [2, 2, 4, 4],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      { best: 10 },
    );
    const res = move(s, "left", createRng(4));
    expect(res.gained).toBe(4 + 8);
    expect(res.state.score).toBe(12);
    expect(res.state.best).toBe(12);
  });
});
