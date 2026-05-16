import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stateFromGrid } from "./engine/game";
import {
  clearGame,
  loadBest,
  loadGame,
  saveBest,
  saveGame,
  type SavedGame,
} from "./storage";

// vitest uses node environment, so we install a minimal in-memory localStorage.
function installLocalStorage(): void {
  const store = new Map<string, string>();
  const ls: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
  };
  (globalThis as { localStorage?: Storage }).localStorage = ls;
}

beforeEach(() => {
  installLocalStorage();
});

afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe("loadBest / saveBest", () => {
  it("returns 0 when empty", () => {
    expect(loadBest()).toBe(0);
  });

  it("round-trips", () => {
    saveBest(1234);
    expect(loadBest()).toBe(1234);
  });

  it("ignores garbage", () => {
    localStorage.setItem("neon-2048.best", "not-a-number");
    expect(loadBest()).toBe(0);
  });

  it("rejects negative", () => {
    localStorage.setItem("neon-2048.best", "-5");
    expect(loadBest()).toBe(0);
  });
});

function makeGame(score = 16): SavedGame {
  const state = stateFromGrid(
    [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    { score, best: score },
  );
  return { state, undo: null, winShown: false };
}

describe("saveGame / loadGame round-trip", () => {
  it("returns missing on first run", () => {
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing");
  });

  it("round-trips a basic state", () => {
    const game = makeGame(42);
    saveGame(game);
    const r = loadGame();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.game.state.score).toBe(42);
      expect(r.game.state.tiles.length).toBe(4);
      expect(r.game.undo).toBeNull();
      expect(r.game.winShown).toBe(false);
    }
  });

  it("round-trips an undo state", () => {
    const game = makeGame(10);
    game.undo = makeGame(0).state;
    saveGame(game);
    const r = loadGame();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.game.undo?.score).toBe(0);
  });

  it("strips animation-only hints (mergedFrom, fresh) on save", () => {
    const game = makeGame(8);
    // Add render-only flags that should NOT survive.
    game.state.tiles[0]!.mergedFrom = [1, 2];
    game.state.tiles[0]!.fresh = true;
    saveGame(game);
    const r = loadGame();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.game.state.tiles[0]!.mergedFrom).toBeUndefined();
      expect(r.game.state.tiles[0]!.fresh).toBeUndefined();
    }
  });

  it("preserves winShown=true", () => {
    const game = makeGame(2048);
    game.winShown = true;
    game.state.won = true;
    saveGame(game);
    const r = loadGame();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.game.winShown).toBe(true);
      expect(r.game.state.won).toBe(true);
    }
  });
});

describe("loadGame error handling", () => {
  it("reports corrupt for non-JSON", () => {
    localStorage.setItem("neon-2048.game", "not json");
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("corrupt");
  });

  it("reports corrupt for wrong shape", () => {
    localStorage.setItem("neon-2048.game", JSON.stringify({ foo: "bar" }));
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("corrupt");
  });

  it("reports corrupt when a tile has an out-of-range position", () => {
    const game = makeGame();
    saveGame(game);
    // Tamper after save.
    const raw = localStorage.getItem("neon-2048.game")!;
    const env = JSON.parse(raw);
    env.game.state.tiles[0].row = 99;
    localStorage.setItem("neon-2048.game", JSON.stringify(env));
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("corrupt");
  });

  it("reports corrupt when a tile value is not a power of two", () => {
    const game = makeGame();
    saveGame(game);
    const raw = localStorage.getItem("neon-2048.game")!;
    const env = JSON.parse(raw);
    env.game.state.tiles[0].value = 3;
    localStorage.setItem("neon-2048.game", JSON.stringify(env));
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("corrupt");
  });

  it("reports version mismatch when schema number changes", () => {
    const game = makeGame();
    saveGame(game);
    const raw = localStorage.getItem("neon-2048.game")!;
    const env = JSON.parse(raw);
    env.v = 999;
    localStorage.setItem("neon-2048.game", JSON.stringify(env));
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("version");
  });

  it("survives a localStorage exception on load", () => {
    // Simulate a broken localStorage (e.g. some private-mode browsers).
    const spy = vi.spyOn(globalThis.localStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("corrupt");
    spy.mockRestore();
  });
});

describe("clearGame", () => {
  it("removes the saved game", () => {
    saveGame(makeGame());
    expect(loadGame().ok).toBe(true);
    clearGame();
    const r = loadGame();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing");
  });

  it("does not affect best score", () => {
    saveBest(500);
    saveGame(makeGame());
    clearGame();
    expect(loadBest()).toBe(500);
  });
});
