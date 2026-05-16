import { describe, expect, it } from "vitest";
import { GestureTracker, gestureToDir, keyToDir } from "./input";

describe("keyToDir", () => {
  it("maps arrow keys", () => {
    expect(keyToDir("ArrowUp")).toBe("up");
    expect(keyToDir("ArrowDown")).toBe("down");
    expect(keyToDir("ArrowLeft")).toBe("left");
    expect(keyToDir("ArrowRight")).toBe("right");
  });

  it("maps WASD case-insensitively", () => {
    expect(keyToDir("w")).toBe("up");
    expect(keyToDir("W")).toBe("up");
    expect(keyToDir("a")).toBe("left");
    expect(keyToDir("s")).toBe("down");
    expect(keyToDir("D")).toBe("right");
  });

  it("maps vim hjkl", () => {
    expect(keyToDir("h")).toBe("left");
    expect(keyToDir("j")).toBe("down");
    expect(keyToDir("k")).toBe("up");
    expect(keyToDir("l")).toBe("right");
  });

  it("returns null for unrelated keys", () => {
    expect(keyToDir("Enter")).toBeNull();
    expect(keyToDir(" ")).toBeNull();
    expect(keyToDir("Tab")).toBeNull();
  });
});

describe("gestureToDir (swipe classifier)", () => {
  it("rejects gestures below the threshold", () => {
    expect(gestureToDir(5, 5)).toBeNull();
    expect(gestureToDir(20, 0)).toBeNull();
  });

  it("classifies clear horizontal swipes", () => {
    expect(gestureToDir(100, 0)).toBe("right");
    expect(gestureToDir(-100, 0)).toBe("left");
    expect(gestureToDir(100, 30)).toBe("right");
  });

  it("classifies clear vertical swipes", () => {
    expect(gestureToDir(0, 100)).toBe("down");
    expect(gestureToDir(0, -100)).toBe("up");
    expect(gestureToDir(30, -100)).toBe("up");
  });

  it("breaks ties via dominant axis on diagonals", () => {
    expect(gestureToDir(50, 50)).not.toBeNull();
    expect(gestureToDir(60, -50)).toBe("right");
    expect(gestureToDir(-50, 60)).toBe("down");
  });
});

describe("GestureTracker — recovery from missed pointerup", () => {
  it("accepts a single complete gesture", () => {
    const g = new GestureTracker();
    expect(g.down(1, 100, 100, 0)).toBe(true);
    expect(g.hasActive()).toBe(true);
    const dir = g.up(1, 200, 100);
    expect(dir).toBe("right");
    expect(g.hasActive()).toBe(false);
  });

  it("rejects a second concurrent pointer while one is fresh", () => {
    const g = new GestureTracker();
    expect(g.down(1, 100, 100, 0)).toBe(true);
    expect(g.down(2, 50, 50, 10)).toBe(false);
  });

  it("RECOVERY: accepts a new pointerdown if the previous one is stale (missed pointerup)", () => {
    // This is the bug we ship-fixed: on iOS Safari the canvas can reflow
    // mid-gesture and pointerup never fires, leaving `activePointer` set
    // forever. After STALE_MS the tracker must let a fresh gesture through.
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    // No matching up() call — pointer is orphaned.
    expect(g.hasActive()).toBe(true);

    // A fresh tap arrives much later — must be accepted.
    const late = GestureTracker.STALE_MS + 100;
    expect(g.down(2, 50, 50, late)).toBe(true);
    // And it should now own the gesture.
    expect(g.up(2, 150, 50)).toBe("right");
  });

  it("up() for a pointer that isn't the active one is a no-op", () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.up(99, 200, 100)).toBeNull();
    // Original pointer still active.
    expect(g.hasActive()).toBe(true);
    expect(g.up(1, 200, 100)).toBe("right");
  });

  it("reset() unconditionally drops the active pointer (used on cancel)", () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    g.reset();
    expect(g.hasActive()).toBe(false);
    // After reset, a new pointer should be accepted immediately.
    expect(g.down(2, 100, 100, 50)).toBe(true);
  });

  it("up() returns null when the gesture is too short (tap, not swipe)", () => {
    const g = new GestureTracker();
    g.down(1, 100, 100, 0);
    expect(g.up(1, 105, 102)).toBeNull(); // ~5px movement — not a swipe
    expect(g.hasActive()).toBe(false);
  });
});
