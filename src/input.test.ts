import { describe, expect, it } from "vitest";
import { keyToDir } from "./input";

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
