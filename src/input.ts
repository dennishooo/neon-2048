import type { Direction } from "./engine/types";

type Listener = (dir: Direction) => void;

const SWIPE_MIN_DIST = 22; // CSS px
const SWIPE_RATIO = 1.25; // axis dominance

export interface InputCtl {
  destroy(): void;
}

/**
 * Stateless: translate a (dx, dy) gesture to a Direction, or null if the
 * gesture is too short to count as a swipe. Pure so it's easy to test.
 */
export function gestureToDir(dx: number, dy: number): Direction | null {
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (Math.max(absX, absY) < SWIPE_MIN_DIST) return null;
  if (absX > absY * SWIPE_RATIO) return dx > 0 ? "right" : "left";
  if (absY > absX * SWIPE_RATIO) return dy > 0 ? "down" : "up";
  // Ambiguous diagonal — fall back to dominant axis.
  return absX >= absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
}

/**
 * State machine for tracking a single touch / mouse gesture.
 *
 * Why a separate class: iOS Safari has a documented bug where pointerup
 * sometimes doesn't fire on the element that received pointerdown — for
 * example when the touched element reflows or moves mid-gesture (which
 * can happen after a merge if the score-card widens or the canvas
 * resizes). If we only listened on the canvas, a dropped pointerup would
 * leave `activePointer` set forever and silently ignore every subsequent
 * touch. The fix: a window-level safety net that always clears state,
 * plus a "stale active pointer" recovery in `down()` that lets a fresh
 * gesture start even if the previous one was orphaned.
 */
export class GestureTracker {
  private activePointer: number | null = null;
  private startX = 0;
  private startY = 0;
  /** Wall-clock time of the active pointerdown; used to age out stuck state. */
  private startTime = 0;

  /** Treat any "active" gesture older than this as orphaned. */
  static readonly STALE_MS = 1500;

  /**
   * Begin tracking. Returns true if accepted. Rejects a duplicate fresh
   * pointer; accepts and replaces a stale one.
   */
  down(pointerId: number, x: number, y: number, now: number): boolean {
    if (this.activePointer !== null && now - this.startTime < GestureTracker.STALE_MS) {
      return false;
    }
    this.activePointer = pointerId;
    this.startX = x;
    this.startY = y;
    this.startTime = now;
    return true;
  }

  /**
   * End tracking for `pointerId`. Returns the swiped direction (or null
   * if it didn't pass the threshold). Returns null if `pointerId` is not
   * the active one.
   */
  up(pointerId: number, x: number, y: number): Direction | null {
    if (this.activePointer !== pointerId) return null;
    const dx = x - this.startX;
    const dy = y - this.startY;
    this.activePointer = null;
    return gestureToDir(dx, dy);
  }

  /** Drop the active pointer unconditionally (e.g. on cancel). */
  reset(): void {
    this.activePointer = null;
  }

  /** Inspect — useful for tests. */
  hasActive(): boolean {
    return this.activePointer !== null;
  }
}

/**
 * Attach unified input handling to an element. Emits a Direction for keyboard
 * arrows/WASD, touch swipes, and mouse drags. The element should be focusable
 * (tabindex) so it can receive key events.
 */
export function attachInput(el: HTMLElement, onMove: Listener): InputCtl {
  const tracker = new GestureTracker();

  const onKey = (e: KeyboardEvent) => {
    const dir = keyToDir(e.key);
    if (!dir) return;
    e.preventDefault();
    onMove(dir);
  };

  const onPointerDown = (e: PointerEvent) => {
    // Mouse: primary button only. Touch / pen: always.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const accepted = tracker.down(e.pointerId, e.clientX, e.clientY, performance.now());
    if (!accepted) return;
    // We don't call setPointerCapture here. On iOS Safari, capture has
    // been observed to drop silently after a canvas reflow, which orphans
    // the gesture and breaks all subsequent input. The window-level
    // listeners below give us recovery without relying on capture.
  };

  const onPointerUp = (e: PointerEvent) => {
    const dir = tracker.up(e.pointerId, e.clientX, e.clientY);
    if (dir) onMove(dir);
  };

  const onPointerCancel = () => {
    tracker.reset();
  };

  el.addEventListener("keydown", onKey);
  el.addEventListener("pointerdown", onPointerDown);
  // Window-level so a missed pointerup on the element (iOS Safari layout-
  // shift quirk) still clears the active gesture.
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);

  // Catch global keys when canvas isn't focused (e.g. after a button click).
  const onWinKey = (e: KeyboardEvent) => {
    if (document.activeElement && document.activeElement.tagName === "BUTTON") {
      // Don't intercept space/enter on buttons.
      if (e.key === " " || e.key === "Enter") return;
    }
    onKey(e);
  };
  window.addEventListener("keydown", onWinKey);

  return {
    destroy() {
      el.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onWinKey);
    },
  };
}

export function keyToDir(key: string): Direction | null {
  switch (key) {
    case "ArrowUp":
    case "w":
    case "W":
    case "k":
      return "up";
    case "ArrowDown":
    case "s":
    case "S":
    case "j":
      return "down";
    case "ArrowLeft":
    case "a":
    case "A":
    case "h":
      return "left";
    case "ArrowRight":
    case "d":
    case "D":
    case "l":
      return "right";
    default:
      return null;
  }
}
