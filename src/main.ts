import "./styles.css";
import {
  createGame,
  hasMovesAvailable,
  move,
  reserveIdsForRestoredState,
  WIN_VALUE,
} from "./engine/game";
import { createRng } from "./engine/rng";
import type { Direction, GameState } from "./engine/types";
import { attachInput } from "./input";
import { registerServiceWorker } from "./pwa";
import { Renderer } from "./render/renderer";
import {
  clearGame,
  loadBest,
  loadGame,
  saveBest,
  saveGame,
  type SavedGame,
} from "./storage";
import {
  applyChrome,
  getTheme,
  loadThemeId,
  saveThemeId,
  THEMES,
  type Theme,
} from "./themes";

const UNDO_DEPTH = 1;

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el;
}

const canvas = $("board") as HTMLCanvasElement;
const scoreEl = $("score");
const bestEl = $("best");
const undoBtn = $("btn-undo") as HTMLButtonElement;
const newBtn = $("btn-new") as HTMLButtonElement;
const themeBtn = $("btn-theme") as HTMLButtonElement;
const themeMenu = $("theme-menu");
const toastEl = $("toast");
const overlay = $("overlay");
const overlayCard = overlay.querySelector(".overlay-card") as HTMLElement;
const overlayTitle = $("overlay-title");
const overlaySub = $("overlay-sub");
const overlayContinue = $("overlay-continue") as HTMLButtonElement;
const overlayRestart = $("overlay-restart") as HTMLButtonElement;

// --- reduced-motion detection ---
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = motionQuery.matches;

// --- theme ---
let theme: Theme = getTheme(loadThemeId());
applyChrome(theme);

const renderer = new Renderer(canvas, { theme, reducedMotion });

// --- restore saved game (if any) ---
const best = loadBest();
const loaded = loadGame();
let game: { state: GameState; rng: ReturnType<typeof createGame>["rng"] };
let undoStack: GameState[] = [];
let winShown = false;

if (loaded.ok) {
  // Carry over the saved state with a fresh, unseeded RNG. We don't call
  // createGame() here because it would burn 2 tile ids (and 2 RNG draws)
  // on starter tiles we'd immediately throw away — and the wasted ids
  // were part of the original collision bug.
  game = { state: { ...loaded.game.state, best }, rng: createRng() };
  if (loaded.game.undo) undoStack = [loaded.game.undo];
  winShown = loaded.game.winShown;
  // CRITICAL: tile ids are a module-level counter that starts at 1 on each
  // page load. Saved tiles carry ids from the previous session (hundreds,
  // after a long game). Without bumping the counter past the restored max,
  // the next spawn reuses a live id and the renderer's per-id animation
  // maps collide — visible as disappearing or wrong-color tiles after
  // ~512 (the point at which sessions get long enough for ids to collide).
  reserveIdsForRestoredState(game.state);
  if (loaded.game.undo) reserveIdsForRestoredState(loaded.game.undo);
  // Make sure "over" reflects current reality in case we changed move-detection.
  game.state.over = !hasMovesAvailable(game.state);
} else {
  game = createGame({ best });
  if (loaded.reason === "corrupt" || loaded.reason === "version") {
    showToast(
      loaded.reason === "version"
        ? "Saved game from a newer version — started fresh."
        : "Couldn't restore saved game — started fresh.",
    );
  }
}

let lastScoreShown = -1;
let lastBestShown = -1;

function refreshHud(prevScore: number): void {
  if (lastScoreShown !== game.state.score) {
    scoreEl.textContent = String(game.state.score);
    if (game.state.score > prevScore) bumpScoreEl(scoreEl);
    lastScoreShown = game.state.score;
  }
  if (lastBestShown !== game.state.best) {
    bestEl.textContent = String(game.state.best);
    lastBestShown = game.state.best;
  }
  undoBtn.disabled = undoStack.length === 0;
}

function bumpScoreEl(el: HTMLElement): void {
  if (reducedMotion) return;
  el.classList.remove("bump");
  void el.offsetWidth;
  el.classList.add("bump");
}

function showOverlay(kind: "win" | "lose"): void {
  overlay.hidden = false;
  if (kind === "win") {
    overlayCard.classList.remove("lose");
    overlayTitle.textContent = "You Win!";
    overlaySub.textContent = `Reached ${WIN_VALUE}`;
    overlayContinue.hidden = false;
  } else {
    overlayCard.classList.add("lose");
    overlayTitle.textContent = "Game Over";
    overlaySub.textContent = `Final score ${game.state.score}`;
    overlayContinue.hidden = true;
  }
}

function hideOverlay(): void {
  overlay.hidden = true;
}

function resetGame(): void {
  game = createGame({ best: game.state.best });
  undoStack = [];
  winShown = false;
  lastScoreShown = -1;
  lastBestShown = -1;
  hideOverlay();
  renderer.setState(game.state);
  refreshHud(0);
  // Drop the previous save so closing now doesn't reload the old board.
  clearGame();
  // Persist the new starting position so it survives an immediate close too.
  persist();
}

function currentSnapshot(): SavedGame {
  return {
    state: game.state,
    undo: undoStack[undoStack.length - 1] ?? null,
    winShown,
  };
}

function persist(): void {
  saveGame(currentSnapshot());
}

function showToast(message: string, ms = 2800): void {
  toastEl.textContent = message;
  toastEl.classList.remove("out");
  toastEl.hidden = false;
  window.setTimeout(() => {
    toastEl.classList.add("out");
    window.setTimeout(() => {
      toastEl.hidden = true;
      toastEl.classList.remove("out");
    }, 240);
  }, ms);
}

function handleMove(dir: Direction): void {
  if (game.state.over) return;
  if (!overlay.hidden && overlayCard.classList.contains("lose")) return;

  const prev = game.state;
  const result = move(prev, dir, game.rng);
  if (!result.changed) return;

  if (undoStack.length >= UNDO_DEPTH) undoStack.shift();
  undoStack.push(prev);

  game = { state: result.state, rng: game.rng };
  if (game.state.best > 0) saveBest(game.state.best);

  renderer.applyTransition(prev, result.state, result.spawnedId);
  refreshHud(prev.score);

  if (result.justWon && !winShown) {
    winShown = true;
    setTimeout(() => showOverlay("win"), 380);
  } else if (game.state.over) {
    setTimeout(() => showOverlay("lose"), 380);
  }

  // Save after every successful move so progress survives a forced close.
  persist();
}

function handleUndo(): void {
  const prev = undoStack.pop();
  if (!prev) return;
  game = { state: prev, rng: game.rng };
  game.state.over = !hasMovesAvailable(game.state);
  hideOverlay();
  renderer.setState(game.state);
  refreshHud(prev.score);
  persist();
}

// ---------- Theme menu ----------

function buildThemeMenu(): void {
  themeMenu.innerHTML = "";
  for (const t of THEMES) {
    const item = document.createElement("button");
    item.className = "theme-item";
    item.role = "menuitemradio";
    item.dataset.themeId = t.id;
    item.setAttribute("aria-checked", t.id === theme.id ? "true" : "false");

    const sw = document.createElement("span");
    sw.className = "theme-swatch";
    for (const c of t.swatch) {
      const s = document.createElement("span");
      s.style.background = c;
      sw.appendChild(s);
    }

    const label = document.createElement("span");
    label.className = "label";
    label.textContent = t.name;

    const check = document.createElement("span");
    check.className = "check";
    check.textContent = "✓";

    item.appendChild(sw);
    item.appendChild(label);
    item.appendChild(check);
    item.addEventListener("click", () => selectTheme(t.id));
    themeMenu.appendChild(item);
  }
}

function selectTheme(id: string): void {
  const t = getTheme(id);
  theme = t;
  saveThemeId(t.id);
  applyChrome(t);
  renderer.setTheme(t);
  // Update aria-checked
  for (const el of themeMenu.querySelectorAll<HTMLButtonElement>(".theme-item")) {
    el.setAttribute("aria-checked", el.dataset.themeId === t.id ? "true" : "false");
  }
  closeThemeMenu();
}

function openThemeMenu(): void {
  themeMenu.hidden = false;
  themeBtn.setAttribute("aria-expanded", "true");
  // Defer so the click that opened it isn't immediately caught.
  setTimeout(() => {
    document.addEventListener("click", onDocClick, { once: true });
  }, 0);
}

function closeThemeMenu(): void {
  themeMenu.hidden = true;
  themeBtn.setAttribute("aria-expanded", "false");
}

function onDocClick(e: MouseEvent): void {
  const t = e.target as Node;
  if (!themeMenu.contains(t) && !themeBtn.contains(t)) {
    closeThemeMenu();
  } else if (!themeMenu.hidden) {
    // Re-arm for the next outside click.
    document.addEventListener("click", onDocClick, { once: true });
  }
}

function bindUi(): void {
  newBtn.addEventListener("click", resetGame);
  overlayRestart.addEventListener("click", resetGame);
  overlayContinue.addEventListener("click", hideOverlay);

  undoBtn.addEventListener("click", handleUndo);

  themeBtn.addEventListener("click", () => {
    if (themeMenu.hidden) openThemeMenu();
    else closeThemeMenu();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !themeMenu.hidden) {
      closeThemeMenu();
      return;
    }
    if (e.key === "z" || e.key === "Z") handleUndo();
    if (e.key === "r" || e.key === "R") {
      if (e.metaKey || e.ctrlKey) return; // don't hijack reload
      resetGame();
    }
  });

  motionQuery.addEventListener("change", (e) => {
    reducedMotion = e.matches;
    renderer.setReducedMotion(reducedMotion);
  });

  // Save aggressively when the app is being backgrounded. iOS Safari is
  // particularly eager to kill backgrounded tabs, and `pagehide` is the
  // last hook we get on mobile. `visibilitychange` covers tab switches.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist();
  });
  window.addEventListener("pagehide", persist);
}

function bindResize(): void {
  const ro = new ResizeObserver(() => renderer.resize());
  ro.observe(canvas);
  window.addEventListener("orientationchange", () => renderer.resize());
}

attachInput(canvas, handleMove);
buildThemeMenu();
bindUi();
bindResize();

renderer.setState(game.state);
renderer.resize();
renderer.start();
refreshHud(0);

// If we restored a finished game, surface the lose overlay so it doesn't
// look interactive. (We don't re-show the win overlay — winShown was
// persisted so the user isn't pestered every reload.)
if (game.state.over) {
  showOverlay("lose");
}

canvas.focus();

registerServiceWorker();

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-console
  console.info("[neon-2048] dev build — arrows/WASD/swipe/drag, Z=undo, R=restart");
}
