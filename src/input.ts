import type { Direction } from "./engine/types";

type Listener = (dir: Direction) => void;

const SWIPE_MIN_DIST = 22; // CSS px
const SWIPE_RATIO = 1.25; // axis dominance

export interface InputCtl {
  destroy(): void;
}

/**
 * Attach unified input handling to an element. Emits a Direction for keyboard
 * arrows/WASD, touch swipes, and mouse drags. The element should be focusable
 * (tabindex) so it can receive key events.
 */
export function attachInput(el: HTMLElement, onMove: Listener): InputCtl {
  const onKey = (e: KeyboardEvent) => {
    const dir = keyToDir(e.key);
    if (!dir) return;
    e.preventDefault();
    onMove(dir);
  };

  // Pointer-based: handles both touch and mouse (pointer events unify them).
  let startX = 0;
  let startY = 0;
  let activePointer: number | null = null;

  const onPointerDown = (e: PointerEvent) => {
    if (activePointer !== null) return;
    // For mouse, only respond to primary button.
    if (e.pointerType === "mouse" && e.button !== 0) return;
    activePointer = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    el.setPointerCapture(e.pointerId);
  };

  const finish = (e: PointerEvent) => {
    if (activePointer !== e.pointerId) return;
    activePointer = null;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* element may already have lost capture */
    }
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) < SWIPE_MIN_DIST) return;
    let dir: Direction;
    if (absX > absY * SWIPE_RATIO) {
      dir = dx > 0 ? "right" : "left";
    } else if (absY > absX * SWIPE_RATIO) {
      dir = dy > 0 ? "down" : "up";
    } else {
      // Ambiguous diagonal — fall back to dominant axis.
      dir =
        absX >= absY
          ? dx > 0
            ? "right"
            : "left"
          : dy > 0
            ? "down"
            : "up";
    }
    onMove(dir);
  };

  const onPointerCancel = (e: PointerEvent) => {
    if (activePointer === e.pointerId) activePointer = null;
  };

  el.addEventListener("keydown", onKey);
  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointerup", finish);
  el.addEventListener("pointercancel", onPointerCancel);

  // Also catch global keys when canvas isn't focused (e.g. after clicking a button)
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
      el.removeEventListener("pointerup", finish);
      el.removeEventListener("pointercancel", onPointerCancel);
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
