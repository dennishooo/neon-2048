import { describe, expect, it } from "vitest";
import { DEFAULT_THEME_ID, getTheme, skinFor, THEMES } from "./themes";

describe("themes", () => {
  it("exposes at least the default theme", () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(1);
    expect(THEMES.some((t) => t.id === DEFAULT_THEME_ID)).toBe(true);
  });

  it("getTheme returns named theme when present", () => {
    for (const t of THEMES) {
      expect(getTheme(t.id).id).toBe(t.id);
    }
  });

  it("getTheme falls back to neon for unknown / null", () => {
    expect(getTheme(null).id).toBe("neon");
    expect(getTheme(undefined).id).toBe("neon");
    expect(getTheme("not-a-theme").id).toBe("neon");
  });

  it("every theme has tiles for the standard ladder", () => {
    const ladder = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];
    for (const t of THEMES) {
      for (const v of ladder) {
        expect(t.tiles[v], `${t.id} missing tile ${v}`).toBeDefined();
      }
    }
  });

  it("skinFor returns a defined skin for any value, including beyond 2048", () => {
    for (const t of THEMES) {
      const beyond = skinFor(t, 4096);
      expect(beyond.from).toBeTruthy();
      expect(beyond.to).toBeTruthy();
      expect(beyond.fg).toBeTruthy();
    }
  });
});
