import { describe, expect, it } from "vitest";
import {
  _resetIdCounterForTests,
  createGame,
  gridValues,
  hasMovesAvailable,
  move,
  reserveIdsForRestoredState,
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

describe("tile id reservation (post-restore)", () => {
  it("restored state + subsequent move yields unique tile ids", () => {
    // Simulate the production bug: counter starts fresh (page reload),
    // but the restored state has high tile ids from a long session.
    _resetIdCounterForTests();

    // A board where "right" actually shifts tiles, so a spawn fires.
    const restored = stateFromGrid([
      [2, 0, 4, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    // Bump tile ids artificially to simulate "after running to 512".
    const maxRestoredId = 201;
    restored.tiles[0]!.id = 200;
    restored.tiles[1]!.id = maxRestoredId;

    reserveIdsForRestoredState(restored);

    const res = move(restored, "right", createRng(7));
    expect(res.changed).toBe(true);

    const ids = new Set(res.state.tiles.map((t) => t.id));
    expect(ids.size).toBe(res.state.tiles.length); // no collisions

    // The spawned tile must carry an id past the restored watermark.
    expect(res.spawnedId).toBeDefined();
    expect(res.spawnedId!).toBeGreaterThan(maxRestoredId);
  });

  it("does not lower nextId if the counter is already past the state's max", () => {
    _resetIdCounterForTests();
    // Burn through ids so nextId is at 50.
    const fresh = createGame({ seed: 1 }).state;
    expect(fresh.tiles[0]!.id).toBeGreaterThan(0);
    for (let i = 0; i < 48; i++) {
      // Force more ids by repeatedly creating tiles via stateFromGrid.
      stateFromGrid([
        [2, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ]);
    }
    // Now restore a state with tiny ids — reserveIds must NOT roll back.
    const restored = stateFromGrid([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    restored.tiles[0]!.id = 2;
    reserveIdsForRestoredState(restored);

    const res = move(restored, "right", createRng(5));
    expect(res.changed).toBe(true);
    const ids = new Set(res.state.tiles.map((t) => t.id));
    expect(ids.size).toBe(res.state.tiles.length);
  });

  it("plays through a long sequence (8 -> 16 -> 32 -> 64) without id collisions", () => {
    _resetIdCounterForTests();
    let state = stateFromGrid([
      [4, 4, 0, 0],
      [4, 4, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const rng = createRng(123);
    for (let i = 0; i < 30; i++) {
      const dir = (["left", "up", "right", "down"] as const)[i % 4];
      const res = move(state, dir, rng);
      state = res.state;
      const ids = new Set(state.tiles.map((t) => t.id));
      expect(ids.size, `move ${i} (${dir}) produced colliding ids`).toBe(state.tiles.length);
      if (state.over) break;
    }
  });
});

describe("game progression to 2048 (integration)", () => {
  it("climbs the value ladder via real merges, win flagged exactly once", () => {
    _resetIdCounterForTests();

    // Seed a near-win position: bottom row primed to make a 1024, top row
    // already has a 1024 ready to merge with it on the next vertical move.
    let state = stateFromGrid([
      [1024, 0, 0, 0],
      [0, 0, 0, 0],
      [512, 0, 0, 0],
      [512, 0, 0, 0],
    ]);
    const rng = createRng(2048);

    // First move: collapse 512 + 512 -> 1024 in column 0.
    const r1 = move(state, "down", rng);
    expect(r1.changed).toBe(true);
    expect(r1.gained).toBe(1024);
    expect(r1.justWon).toBe(false); // not yet
    state = r1.state;

    // Verify the two 1024s now occupy column 0 (the merged-down one at
    // the bottom, the original one still at the top after sliding down).
    const col0 = state.tiles.filter((t) => t.col === 0).sort((a, b) => a.row - b.row);
    expect(col0.map((t) => t.value)).toContain(1024);

    // Subsequent moves should never collide ids, and the win flag should
    // fire on exactly the move that creates 2048.
    let firstWinMoveIdx = -1;
    let winCount = 0;
    for (let i = 0; i < 20; i++) {
      // Always try "down" first so the two 1024s collapse if possible.
      const dirs = ["down", "left", "right", "up"] as const;
      let played = false;
      for (const d of dirs) {
        const r = move(state, d, rng);
        if (r.changed) {
          state = r.state;
          if (r.justWon) {
            winCount++;
            if (firstWinMoveIdx === -1) firstWinMoveIdx = i;
          }
          // Id-collision invariant must hold every move.
          const ids = new Set(state.tiles.map((t) => t.id));
          expect(ids.size, `move ${i} (${d}) had colliding ids`).toBe(state.tiles.length);
          played = true;
          break;
        }
      }
      if (!played || state.over || state.tiles.some((t) => t.value >= WIN_VALUE)) break;
    }

    // We should have reached 2048 at least once via real merges.
    expect(state.tiles.some((t) => t.value >= WIN_VALUE)).toBe(true);
    expect(winCount).toBe(1); // justWon is one-shot
    expect(firstWinMoveIdx).toBeGreaterThanOrEqual(0);
    expect(state.won).toBe(true);
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
