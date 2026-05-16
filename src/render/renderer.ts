import type { GameState, Tile, TileId } from "../engine/types";
import { type Theme } from "../themes";
import { clamp01, easeOutBack, easeOutCubic, easeOutQuint } from "./easing";
import { TileSpriteCache } from "./sprite-cache";

// Base timing. Slides scale up with travel distance; merge pulse triggers
// once the slide lands; spawn waits for the slide to finish so it doesn't
// appear under a moving tile.
const SLIDE_BASE_MS = 150;
const SLIDE_PER_CELL_MS = 22;
const ANIM_MERGE_MS = 240;
const ANIM_SPAWN_MS = 220;
const ANIM_FLOATER_MS = 760;
const SHAKE_MS = 320;
const SHAKE_MIN_VALUE = 256;

interface MoveAnim {
  id: TileId;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  start: number;
  duration: number;
}

interface SpawnAnim {
  id: TileId;
  start: number;
}

interface MergeAnim {
  id: TileId;
  start: number;
}

interface Floater {
  text: string;
  row: number;
  col: number;
  start: number;
}

interface ShakeAnim {
  start: number;
  amplitude: number;
}

export interface RendererOpts {
  theme: Theme;
  reducedMotion: boolean;
}

/**
 * The renderer keeps its own "displayed" state independent from the engine's
 * logical state. After every engine move we call `applyTransition(prev, next)`
 * to compute slide animations.
 */
export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private cssSize = 0;

  private state: GameState | null = null;
  private animBaseline: Map<TileId, Tile> = new Map();

  private moves = new Map<TileId, MoveAnim>();
  private ghosts = new Map<TileId, MoveAnim>();
  private spawns = new Map<TileId, SpawnAnim>();
  private merges = new Map<TileId, MergeAnim>();
  private floaters: Floater[] = [];
  private shake: ShakeAnim | null = null;

  private theme: Theme;
  private reducedMotion: boolean;

  /** Pre-rendered tile faces. Rebuilt on resize and on theme change. */
  private sprites: TileSpriteCache;
  /** Last cell px size used to build the cache; if the canvas resizes
   * enough we rebuild so the sprites stay sharp. */
  private cachedCellPx = 0;

  private rafHandle = 0;
  private dirty = true;

  constructor(canvas: HTMLCanvasElement, opts: RendererOpts) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    this.ctx = ctx;
    this.theme = opts.theme;
    this.reducedMotion = opts.reducedMotion;
    this.sprites = new TileSpriteCache(this.theme, 64, 1);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    // Invalidate sprite cache — palettes changed.
    this.sprites.reset(theme, this.cachedCellPx || 64, this.dpr);
    this.dirty = true;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  setState(state: GameState): void {
    this.state = state;
    this.moves.clear();
    this.ghosts.clear();
    this.spawns.clear();
    this.merges.clear();
    this.floaters.length = 0;
    this.shake = null;
    this.dirty = true;
  }

  /**
   * Set up animations for a transition. `prev` and `next` are engine states
   * with stable tile ids.
   */
  applyTransition(prev: GameState, next: GameState, spawnedId?: TileId): void {
    const now = performance.now();
    this.animBaseline = new Map(prev.tiles.map((t) => [t.id, t]));
    this.moves.clear();
    this.ghosts.clear();
    this.spawns.clear();
    this.merges.clear();

    const prevById = this.animBaseline;
    let maxSlide = 0;
    let biggestMerge = 0;

    for (const nextTile of next.tiles) {
      if (spawnedId !== undefined && nextTile.id === spawnedId) {
        // Spawn waits for the longest slide to land.
        this.spawns.set(nextTile.id, { id: nextTile.id, start: 0 /* set below */ });
        continue;
      }
      if (nextTile.mergedFrom) {
        const [keptId, eatenId] = nextTile.mergedFrom;
        const kept = prevById.get(keptId);
        const eaten = prevById.get(eatenId);
        if (kept) {
          const dist = Math.abs(kept.row - nextTile.row) + Math.abs(kept.col - nextTile.col);
          const duration = this.slideDuration(dist);
          maxSlide = Math.max(maxSlide, duration);
          this.moves.set(nextTile.id, {
            id: nextTile.id,
            fromRow: kept.row,
            fromCol: kept.col,
            toRow: nextTile.row,
            toCol: nextTile.col,
            start: now,
            duration,
          });
        }
        if (eaten) {
          const dist = Math.abs(eaten.row - nextTile.row) + Math.abs(eaten.col - nextTile.col);
          const duration = this.slideDuration(dist);
          maxSlide = Math.max(maxSlide, duration);
          this.ghosts.set(eatenId, {
            id: eatenId,
            fromRow: eaten.row,
            fromCol: eaten.col,
            toRow: nextTile.row,
            toCol: nextTile.col,
            start: now,
            duration,
          });
        }
        this.merges.set(nextTile.id, { id: nextTile.id, start: 0 /* set below */ });
        this.floaters.push({
          text: `+${nextTile.value}`,
          row: nextTile.row,
          col: nextTile.col,
          start: 0,
        });
        biggestMerge = Math.max(biggestMerge, nextTile.value);
      } else {
        const prior = prevById.get(nextTile.id);
        if (prior && (prior.row !== nextTile.row || prior.col !== nextTile.col)) {
          const dist = Math.abs(prior.row - nextTile.row) + Math.abs(prior.col - nextTile.col);
          const duration = this.slideDuration(dist);
          maxSlide = Math.max(maxSlide, duration);
          this.moves.set(nextTile.id, {
            id: nextTile.id,
            fromRow: prior.row,
            fromCol: prior.col,
            toRow: nextTile.row,
            toCol: nextTile.col,
            start: now,
            duration,
          });
        }
      }
    }

    // Schedule post-slide animations.
    const slideEnd = now + maxSlide;
    for (const sp of this.spawns.values()) sp.start = slideEnd;
    for (const mg of this.merges.values()) mg.start = slideEnd;
    for (const f of this.floaters) {
      if (f.start === 0) f.start = slideEnd;
    }

    // Trigger shake on big merges.
    if (!this.reducedMotion && biggestMerge >= SHAKE_MIN_VALUE) {
      // Scale amplitude with value: 256 -> ~4px, 1024 -> ~8px, 2048 -> ~11px (capped).
      const amp = Math.min(12, 3 + Math.log2(biggestMerge / 128) * 1.8);
      this.shake = { start: slideEnd, amplitude: amp };
    }

    this.state = next;
    this.dirty = true;
  }

  private slideDuration(distance: number): number {
    if (this.reducedMotion) return 0;
    return SLIDE_BASE_MS + SLIDE_PER_CELL_MS * Math.max(0, distance - 1);
  }

  /** Resize the backing store to match CSS size × device pixel ratio. */
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));
    const cssSize = Math.min(rect.width, rect.height);
    this.dpr = dpr;
    this.cssSize = cssSize;
    const px = Math.floor(cssSize * dpr);
    if (this.canvas.width !== px || this.canvas.height !== px) {
      this.canvas.width = px;
      this.canvas.height = px;
    }
    // Recompute cell px and rebuild the sprite cache if the cell size
    // shifted enough to matter (>1px CSS).
    const state = this.state;
    if (state) {
      const pad = cssSize * 0.04;
      const inner = cssSize - pad * 2;
      const gap = inner * 0.022;
      const cell = (inner - gap * (state.size - 1)) / state.size;
      if (Math.abs(cell - this.cachedCellPx) > 1) {
        this.cachedCellPx = cell;
        this.sprites.reset(this.theme, cell, dpr);
      }
    }
    this.dirty = true;
  }

  start(): void {
    if (this.rafHandle) return;
    const tick = (now: number) => {
      this.rafHandle = requestAnimationFrame(tick);
      this.frame(now);
    };
    this.rafHandle = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.rafHandle) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = 0;
    }
  }

  private frame(now: number): void {
    let animating = false;

    // Completed move animations are cleared here so the map doesn't grow
    // unbounded across moves — previously these were leaked every turn.
    for (const m of this.moves.values()) {
      if (now - m.start < m.duration) animating = true;
      else this.moves.delete(m.id);
    }
    for (const g of this.ghosts.values()) {
      if (now - g.start < g.duration) animating = true;
      else this.ghosts.delete(g.id);
    }
    for (const mg of this.merges.values()) {
      if (now < mg.start || now - mg.start < ANIM_MERGE_MS) animating = true;
      else this.merges.delete(mg.id);
    }
    for (const sp of this.spawns.values()) {
      if (now < sp.start || now - sp.start < ANIM_SPAWN_MS) animating = true;
      else this.spawns.delete(sp.id);
    }
    if (this.floaters.length) {
      this.floaters = this.floaters.filter(
        (f) => now < f.start || now - f.start < ANIM_FLOATER_MS,
      );
      if (this.floaters.length > 0) animating = true;
    }
    if (this.shake) {
      if (now < this.shake.start || now - this.shake.start < SHAKE_MS) animating = true;
      else this.shake = null;
    }

    if (animating || this.dirty) {
      this.draw(now);
      this.dirty = animating;
    }
  }

  private draw(now: number): void {
    const state = this.state;
    if (!state) return;
    const ctx = this.ctx;
    const theme = this.theme;
    const size = state.size;
    const dpr = this.dpr;
    const W = this.cssSize;
    const pad = W * 0.04;
    const inner = W - pad * 2;
    const gap = inner * 0.022;
    const cell = (inner - gap * (size - 1)) / size;

    // Compute shake offset.
    let shx = 0;
    let shy = 0;
    if (this.shake && now >= this.shake.start) {
      const t = clamp01((now - this.shake.start) / SHAKE_MS);
      const decay = 1 - t;
      const phase = (now - this.shake.start) * 0.06;
      shx = Math.sin(phase * 1.7) * this.shake.amplitude * decay;
      shy = Math.cos(phase * 2.1) * this.shake.amplitude * decay * 0.7;
    }

    ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
    ctx.clearRect(-Math.abs(shx) - 2, -Math.abs(shy) - 2, W + Math.abs(shx) * 2 + 4, W + Math.abs(shy) * 2 + 4);

    // Board background fill (in case canvas bg shows through during shake).
    const boardGrad = ctx.createLinearGradient(0, 0, 0, W);
    boardGrad.addColorStop(0, theme.board.boardTop);
    boardGrad.addColorStop(1, theme.board.boardBottom);
    roundRect(ctx, 0, 0, W, W, W * 0.04);
    ctx.fillStyle = boardGrad;
    ctx.fill();

    // Grid cells
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = pad + c * (cell + gap);
        const y = pad + r * (cell + gap);
        roundRect(ctx, x, y, cell, cell, cell * 0.14);
        ctx.fillStyle = theme.board.cellFill;
        ctx.fill();
        ctx.strokeStyle = theme.board.cellStroke;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Ghost tiles (eaten by merges) — drawn under living tiles.
    for (const g of this.ghosts.values()) {
      const baseTile = this.animBaseline.get(g.id);
      if (!baseTile) continue;
      const t = clamp01((now - g.start) / g.duration);
      const e = easeOutQuint(t);
      const fr = lerp(g.fromRow, g.toRow, e);
      const fc = lerp(g.fromCol, g.toCol, e);
      const x = pad + fc * (cell + gap);
      const y = pad + fr * (cell + gap);
      this.drawTile(ctx, x, y, cell, baseTile.value, 1, 1);
    }

    // Living tiles.
    for (const tile of state.tiles) {
      let row = tile.row;
      let col = tile.col;
      const mv = this.moves.get(tile.id);
      if (mv) {
        const t = clamp01((now - mv.start) / mv.duration);
        const e = easeOutQuint(t);
        row = lerp(mv.fromRow, mv.toRow, e);
        col = lerp(mv.fromCol, mv.toCol, e);
      }

      let scale = 1;
      let alpha = 1;
      const sp = this.spawns.get(tile.id);
      if (sp) {
        if (now < sp.start) continue; // hold until slide finishes
        const t = clamp01((now - sp.start) / ANIM_SPAWN_MS);
        scale = easeOutBack(t) * 0.45 + 0.55;
        alpha = easeOutCubic(t);
      }
      const mg = this.merges.get(tile.id);
      if (mg && now >= mg.start) {
        const t = clamp01((now - mg.start) / ANIM_MERGE_MS);
        const pulse = Math.sin(t * Math.PI);
        scale = 1 + pulse * 0.14;
      }

      const x = pad + col * (cell + gap);
      const y = pad + row * (cell + gap);
      this.drawTile(ctx, x, y, cell, tile.value, scale, alpha);
    }

    // Floaters ("+N") — drawn last so they sit on top.
    if (this.floaters.length) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const f of this.floaters) {
        if (now < f.start) continue;
        const t = clamp01((now - f.start) / ANIM_FLOATER_MS);
        const rise = cell * 0.55 * easeOutCubic(t);
        const alpha = 1 - easeOutCubic(t);
        const x = pad + f.col * (cell + gap) + cell / 2;
        const y = pad + f.row * (cell + gap) + cell / 2 - rise;
        const size = cell * 0.22;
        ctx.globalAlpha = alpha;
        ctx.font = `800 ${size}px ui-sans-serif, system-ui, -apple-system, "SF Pro Display", "Segoe UI", Roboto, Inter, sans-serif`;
        // Soft outline for legibility on bright tiles
        ctx.lineWidth = Math.max(2, size * 0.18);
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.strokeText(f.text, x, y);
        ctx.fillStyle = theme.board.floaterColor;
        ctx.fillText(f.text, x, y);
      }
      ctx.restore();
    }
  }

  private drawTile(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    value: number,
    scale: number,
    alpha: number,
  ): void {
    const sprite = this.sprites.get(value, this.theme);
    // The sprite is oversized vs. the cell to give the glow halo room.
    // Compute its draw rect using the same ratios the cache used.
    const spriteCss = size * 1.18 * 1.3 * scale;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const dx = cx - spriteCss / 2;
    const dy = cy - spriteCss / 2;

    const needAlpha = alpha < 1;
    if (needAlpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
    }
    ctx.drawImage(sprite, dx, dy, spriteCss, spriteCss);
    if (needAlpha) ctx.restore();
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
