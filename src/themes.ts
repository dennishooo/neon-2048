import type { TileSkin } from "./render/palette";

/** Page-level (HTML/CSS) chrome colors. Applied via CSS variables on :root. */
export interface ThemeChrome {
  /** Two-stop body background. */
  bg0: string;
  bg1: string;
  /** Three optional radial-glow tints behind the page. */
  glowA: string;
  glowB: string;
  glowC: string;
  /** Foreground text colors. */
  text: string;
  textDim: string;
  /** Accent gradient used for the "2048" wordmark + primary button. */
  accentA: string;
  accentB: string;
  accentC: string;
  /** Best-score gradient. */
  bestA: string;
  bestB: string;
  /** Surfaces (glass cards / borders). */
  surface: string;
  surface2: string;
  border: string;
}

/** Canvas (board) colors. */
export interface ThemeBoard {
  /** Inner gradient of the board background — two stops, top → bottom. */
  boardTop: string;
  boardBottom: string;
  /** Each empty cell's fill + outline. */
  cellFill: string;
  cellStroke: string;
  /** Skin for the score floaters ("+N" labels rising from merges). */
  floaterColor: string;
}

export interface Theme {
  id: string;
  name: string;
  chrome: ThemeChrome;
  board: ThemeBoard;
  /** Per-value tile skins. Falls back to `tileFallback` for values past 2048. */
  tiles: Record<number, TileSkin>;
  tileFallback: TileSkin;
  /** Optional swatch shown in the picker dropdown. */
  swatch: [string, string, string];
}

const NEON: Theme = {
  id: "neon",
  name: "Neon",
  chrome: {
    bg0: "#070811",
    bg1: "#0b0d17",
    glowA: "rgba(124, 92, 255, 0.22)",
    glowB: "rgba(34, 211, 238, 0.18)",
    glowC: "rgba(244, 114, 182, 0.08)",
    text: "#e8ecf7",
    textDim: "#9aa3bd",
    accentA: "#7c5cff",
    accentB: "#22d3ee",
    accentC: "#f472b6",
    bestA: "#ffd166",
    bestB: "#f472b6",
    surface: "rgba(255, 255, 255, 0.04)",
    surface2: "rgba(255, 255, 255, 0.07)",
    border: "rgba(255, 255, 255, 0.08)",
  },
  board: {
    boardTop: "#141828",
    boardBottom: "#0d101c",
    cellFill: "rgba(255,255,255,0.035)",
    cellStroke: "rgba(255,255,255,0.04)",
    floaterColor: "#e8ecf7",
  },
  tiles: {
    2: { from: "#2a2f4a", to: "#1b1f33", glow: "rgba(124,92,255,0.10)", fg: "#dde2f5" },
    4: { from: "#3a3162", to: "#241e44", glow: "rgba(124,92,255,0.20)", fg: "#ecdcff" },
    8: { from: "#4a3aa5", to: "#2c2168", glow: "rgba(124,92,255,0.40)", fg: "#f4ecff" },
    16: { from: "#5e36c7", to: "#2f1f7a", glow: "rgba(124,92,255,0.55)", fg: "#ffffff" },
    32: { from: "#7b3ad6", to: "#3a1f8a", glow: "rgba(155,92,255,0.65)", fg: "#ffffff" },
    64: { from: "#a23bc7", to: "#5a1f8c", glow: "rgba(200,80,255,0.70)", fg: "#ffffff" },
    128: { from: "#3aa2ff", to: "#1c4cb8", glow: "rgba(58,162,255,0.65)", fg: "#ffffff" },
    256: { from: "#22d3ee", to: "#0d8aa8", glow: "rgba(34,211,238,0.65)", fg: "#0a0f1e" },
    512: { from: "#34e3a8", to: "#119166", glow: "rgba(52,227,168,0.65)", fg: "#0a1e16" },
    1024: { from: "#facc15", to: "#a37a05", glow: "rgba(250,204,21,0.65)", fg: "#1a1303" },
    2048: { from: "#fb7185", to: "#be1d3a", glow: "rgba(251,113,133,0.80)", fg: "#1f0810" },
  },
  tileFallback: { from: "#f472b6", to: "#7c5cff", glow: "rgba(244,114,182,0.80)", fg: "#1a0a18" },
  swatch: ["#7c5cff", "#22d3ee", "#f472b6"],
};

const CLASSIC: Theme = {
  id: "classic",
  name: "Classic",
  chrome: {
    bg0: "#faf8ef",
    bg1: "#f5efde",
    glowA: "rgba(237, 194, 46, 0.20)",
    glowB: "rgba(245, 149, 99, 0.18)",
    glowC: "rgba(238, 228, 218, 0.30)",
    text: "#776e65",
    textDim: "#a89c8c",
    accentA: "#edc22e",
    accentB: "#f59563",
    accentC: "#f67c5f",
    bestA: "#edc22e",
    bestB: "#f67c5f",
    surface: "rgba(238, 228, 218, 0.55)",
    surface2: "rgba(238, 228, 218, 0.85)",
    border: "rgba(187, 173, 160, 0.55)",
  },
  board: {
    boardTop: "#bbada0",
    boardBottom: "#a89484",
    cellFill: "rgba(238, 228, 218, 0.35)",
    cellStroke: "rgba(255,255,255,0.06)",
    floaterColor: "#776e65",
  },
  tiles: {
    2:    { from: "#eee4da", to: "#eee4da", glow: "rgba(0,0,0,0.05)", fg: "#776e65" },
    4:    { from: "#ede0c8", to: "#ede0c8", glow: "rgba(0,0,0,0.05)", fg: "#776e65" },
    8:    { from: "#f2b179", to: "#f2b179", glow: "rgba(242,177,121,0.45)", fg: "#f9f6f2" },
    16:   { from: "#f59563", to: "#f59563", glow: "rgba(245,149,99,0.45)", fg: "#f9f6f2" },
    32:   { from: "#f67c5f", to: "#f67c5f", glow: "rgba(246,124,95,0.45)", fg: "#f9f6f2" },
    64:   { from: "#f65e3b", to: "#f65e3b", glow: "rgba(246,94,59,0.50)", fg: "#f9f6f2" },
    128:  { from: "#edcf72", to: "#edcf72", glow: "rgba(237,207,114,0.55)", fg: "#f9f6f2" },
    256:  { from: "#edcc61", to: "#edcc61", glow: "rgba(237,204,97,0.60)", fg: "#f9f6f2" },
    512:  { from: "#edc850", to: "#edc850", glow: "rgba(237,200,80,0.65)", fg: "#f9f6f2" },
    1024: { from: "#edc53f", to: "#edc53f", glow: "rgba(237,197,63,0.70)", fg: "#f9f6f2" },
    2048: { from: "#edc22e", to: "#edc22e", glow: "rgba(237,194,46,0.80)", fg: "#f9f6f2" },
  },
  tileFallback: { from: "#3c3a32", to: "#3c3a32", glow: "rgba(60,58,50,0.70)", fg: "#f9f6f2" },
  swatch: ["#edc22e", "#f59563", "#f67c5f"],
};

const SUNSET: Theme = {
  id: "sunset",
  name: "Sunset",
  chrome: {
    bg0: "#160a1f",
    bg1: "#2a0e29",
    glowA: "rgba(255, 122, 89, 0.30)",
    glowB: "rgba(250, 73, 144, 0.25)",
    glowC: "rgba(255, 199, 95, 0.15)",
    text: "#fff3e6",
    textDim: "#d9a8a8",
    accentA: "#ff7a59",
    accentB: "#fa4990",
    accentC: "#ffc75f",
    bestA: "#ffc75f",
    bestB: "#ff7a59",
    surface: "rgba(255, 255, 255, 0.05)",
    surface2: "rgba(255, 255, 255, 0.09)",
    border: "rgba(255, 199, 95, 0.16)",
  },
  board: {
    boardTop: "#3a1638",
    boardBottom: "#1b0a22",
    cellFill: "rgba(255,255,255,0.04)",
    cellStroke: "rgba(255,199,95,0.06)",
    floaterColor: "#ffe7c2",
  },
  tiles: {
    2:    { from: "#4b1f3c", to: "#2a1028", glow: "rgba(250,73,144,0.10)", fg: "#ffe7c2" },
    4:    { from: "#6b2447", to: "#3a1230", glow: "rgba(250,73,144,0.20)", fg: "#ffe7c2" },
    8:    { from: "#a02a55", to: "#5a1635", glow: "rgba(250,73,144,0.40)", fg: "#ffe9d2" },
    16:   { from: "#d1306a", to: "#7c1c3d", glow: "rgba(250,73,144,0.55)", fg: "#fff5e6" },
    32:   { from: "#f0497f", to: "#a8214a", glow: "rgba(250,73,144,0.65)", fg: "#fff8ee" },
    64:   { from: "#ff6a6a", to: "#bd2c46", glow: "rgba(255,106,106,0.70)", fg: "#fff8ee" },
    128:  { from: "#ff7a59", to: "#b2382a", glow: "rgba(255,122,89,0.65)", fg: "#fff8ee" },
    256:  { from: "#ff9347", to: "#b04b1c", glow: "rgba(255,147,71,0.65)", fg: "#fff8ee" },
    512:  { from: "#ffb14a", to: "#a8651b", glow: "rgba(255,177,74,0.65)", fg: "#1f0e02" },
    1024: { from: "#ffc75f", to: "#a37a05", glow: "rgba(255,199,95,0.75)", fg: "#1f1503" },
    2048: { from: "#ffe28a", to: "#c08b1f", glow: "rgba(255,226,138,0.80)", fg: "#22150a" },
  },
  tileFallback: { from: "#fff3e6", to: "#fa4990", glow: "rgba(255,243,230,0.80)", fg: "#22090e" },
  swatch: ["#ff7a59", "#fa4990", "#ffc75f"],
};

const MIDNIGHT: Theme = {
  id: "midnight",
  name: "Midnight",
  chrome: {
    bg0: "#04060e",
    bg1: "#070b1a",
    glowA: "rgba(56, 189, 248, 0.18)",
    glowB: "rgba(34, 211, 238, 0.12)",
    glowC: "rgba(15, 23, 42, 0.30)",
    text: "#e6edf7",
    textDim: "#8aa0c0",
    accentA: "#38bdf8",
    accentB: "#22d3ee",
    accentC: "#67e8f9",
    bestA: "#67e8f9",
    bestB: "#38bdf8",
    surface: "rgba(255, 255, 255, 0.035)",
    surface2: "rgba(255, 255, 255, 0.06)",
    border: "rgba(56, 189, 248, 0.14)",
  },
  board: {
    boardTop: "#0c1424",
    boardBottom: "#060912",
    cellFill: "rgba(255,255,255,0.025)",
    cellStroke: "rgba(56,189,248,0.05)",
    floaterColor: "#cbe9ff",
  },
  tiles: {
    2:    { from: "#1c2538", to: "#0e1422", glow: "rgba(56,189,248,0.08)", fg: "#cbe9ff" },
    4:    { from: "#243553", to: "#111b2f", glow: "rgba(56,189,248,0.14)", fg: "#cbe9ff" },
    8:    { from: "#2a4880", to: "#142348", glow: "rgba(56,189,248,0.30)", fg: "#e6f4ff" },
    16:   { from: "#2f5fb3", to: "#152d66", glow: "rgba(56,189,248,0.45)", fg: "#ffffff" },
    32:   { from: "#3478df", to: "#1a3a85", glow: "rgba(56,189,248,0.55)", fg: "#ffffff" },
    64:   { from: "#38bdf8", to: "#0c5d8c", glow: "rgba(56,189,248,0.65)", fg: "#021126" },
    128:  { from: "#22d3ee", to: "#0c7388", glow: "rgba(34,211,238,0.65)", fg: "#021126" },
    256:  { from: "#67e8f9", to: "#0e93a8", glow: "rgba(103,232,249,0.65)", fg: "#031018" },
    512:  { from: "#a5f3fc", to: "#22c7d8", glow: "rgba(165,243,252,0.70)", fg: "#031018" },
    1024: { from: "#c7f9ff", to: "#67d6ef", glow: "rgba(199,249,255,0.75)", fg: "#021018" },
    2048: { from: "#e2faff", to: "#9adff0", glow: "rgba(226,250,255,0.85)", fg: "#021018" },
  },
  tileFallback: { from: "#f0fbff", to: "#38bdf8", glow: "rgba(240,251,255,0.85)", fg: "#021018" },
  swatch: ["#38bdf8", "#22d3ee", "#67e8f9"],
};

const MONO: Theme = {
  id: "mono",
  name: "Mono",
  chrome: {
    bg0: "#0a0a0a",
    bg1: "#141414",
    glowA: "rgba(255, 255, 255, 0.06)",
    glowB: "rgba(255, 255, 255, 0.04)",
    glowC: "rgba(255, 255, 255, 0.02)",
    text: "#f5f5f5",
    textDim: "#a0a0a0",
    accentA: "#ffffff",
    accentB: "#d4d4d4",
    accentC: "#a3a3a3",
    bestA: "#ffffff",
    bestB: "#a3a3a3",
    surface: "rgba(255, 255, 255, 0.04)",
    surface2: "rgba(255, 255, 255, 0.08)",
    border: "rgba(255, 255, 255, 0.10)",
  },
  board: {
    boardTop: "#1c1c1c",
    boardBottom: "#0e0e0e",
    cellFill: "rgba(255,255,255,0.04)",
    cellStroke: "rgba(255,255,255,0.06)",
    floaterColor: "#f5f5f5",
  },
  tiles: {
    2:    { from: "#262626", to: "#1a1a1a", glow: "rgba(255,255,255,0.05)", fg: "#e5e5e5" },
    4:    { from: "#333333", to: "#202020", glow: "rgba(255,255,255,0.06)", fg: "#ededed" },
    8:    { from: "#454545", to: "#2a2a2a", glow: "rgba(255,255,255,0.08)", fg: "#f5f5f5" },
    16:   { from: "#5a5a5a", to: "#363636", glow: "rgba(255,255,255,0.10)", fg: "#ffffff" },
    32:   { from: "#737373", to: "#454545", glow: "rgba(255,255,255,0.14)", fg: "#ffffff" },
    64:   { from: "#8c8c8c", to: "#525252", glow: "rgba(255,255,255,0.20)", fg: "#0a0a0a" },
    128:  { from: "#a8a8a8", to: "#666666", glow: "rgba(255,255,255,0.30)", fg: "#0a0a0a" },
    256:  { from: "#c4c4c4", to: "#7a7a7a", glow: "rgba(255,255,255,0.40)", fg: "#0a0a0a" },
    512:  { from: "#dcdcdc", to: "#8c8c8c", glow: "rgba(255,255,255,0.55)", fg: "#0a0a0a" },
    1024: { from: "#ededed", to: "#a3a3a3", glow: "rgba(255,255,255,0.70)", fg: "#0a0a0a" },
    2048: { from: "#ffffff", to: "#bfbfbf", glow: "rgba(255,255,255,0.90)", fg: "#0a0a0a" },
  },
  tileFallback: { from: "#ffffff", to: "#888888", glow: "rgba(255,255,255,0.95)", fg: "#0a0a0a" },
  swatch: ["#ffffff", "#a3a3a3", "#525252"],
};

export const THEMES: readonly Theme[] = [NEON, CLASSIC, SUNSET, MIDNIGHT, MONO];

export const DEFAULT_THEME_ID = "neon";

export function getTheme(id: string | null | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? NEON;
}

export function skinFor(theme: Theme, value: number): TileSkin {
  return theme.tiles[value] ?? theme.tileFallback;
}

const THEME_KEY = "neon-2048.theme";

export function loadThemeId(): string {
  try {
    return localStorage.getItem(THEME_KEY) || DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveThemeId(id: string): void {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch {
    /* ignore */
  }
}

/** Whether the theme is light-mode (used to pick contrasting UI bits). */
export function isLightTheme(theme: Theme): boolean {
  return theme.id === "classic";
}

/** Apply chrome variables to :root. Idempotent. */
export function applyChrome(theme: Theme): void {
  const c = theme.chrome;
  const r = document.documentElement.style;
  r.setProperty("--bg-0", c.bg0);
  r.setProperty("--bg-1", c.bg1);
  r.setProperty("--glow-a", c.glowA);
  r.setProperty("--glow-b", c.glowB);
  r.setProperty("--glow-c", c.glowC);
  r.setProperty("--text", c.text);
  r.setProperty("--text-dim", c.textDim);
  r.setProperty("--accent-a", c.accentA);
  r.setProperty("--accent-b", c.accentB);
  r.setProperty("--accent-c", c.accentC);
  r.setProperty("--best-a", c.bestA);
  r.setProperty("--best-b", c.bestB);
  r.setProperty("--surface", c.surface);
  r.setProperty("--surface-2", c.surface2);
  r.setProperty("--border", c.border);
  document.documentElement.dataset.theme = theme.id;
}
