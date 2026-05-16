import { skinFor, type Theme } from "../themes";

/**
 * Tile sprite cache.
 *
 * Drawing a tile from scratch every frame is expensive on mobile Safari
 * because each tile needs:
 *   - shadowBlur (often CPU-blurred on iOS GPUs)
 *   - 2x createLinearGradient
 *   - 3x roundRect paths
 *   - text rendering with a fresh font string
 *
 * With ~16 tiles × 60fps this dominates frame time. Drawing each tile face
 * to an offscreen canvas *once* and then blitting it during animation
 * collapses all of that into one drawImage() call per tile per frame —
 * which is hardware-accelerated everywhere.
 *
 * The cache is keyed by theme id + tile value + cell pixel size; it
 * rebuilds when the canvas resizes or the theme changes.
 */
export class TileSpriteCache {
  private sprites = new Map<number, HTMLCanvasElement>();
  private themeId: string;
  private cellPx: number;
  /** Pixel oversize ratio so the cache is sharp under the renderer's DPR scale. */
  private dpr: number;
  /** Maximum pulse scale we ever draw at — we render the sprite slightly
   * larger than 1.0 so peak-pulse merges don't go soft. */
  private static readonly MAX_SCALE = 1.18;

  constructor(theme: Theme, cellPx: number, dpr: number) {
    this.themeId = theme.id;
    this.cellPx = cellPx;
    this.dpr = dpr;
  }

  /** Invalidate the entire cache. Call after a theme switch or resize. */
  reset(theme: Theme, cellPx: number, dpr: number): void {
    this.themeId = theme.id;
    this.cellPx = cellPx;
    this.dpr = dpr;
    this.sprites.clear();
  }

  /**
   * The sprite's logical size on the canvas (CSS pixels). Larger than the
   * cell to leave room for glow halo + max scale.
   */
  get spriteCssSize(): number {
    return this.cellPx * TileSpriteCache.MAX_SCALE * 1.3;
  }

  /** The cell size the cache was built for. */
  get cellPxSize(): number {
    return this.cellPx;
  }

  get(value: number, theme: Theme): HTMLCanvasElement {
    if (theme.id !== this.themeId) {
      this.themeId = theme.id;
      this.sprites.clear();
    }
    let sprite = this.sprites.get(value);
    if (!sprite) {
      sprite = renderTileSprite(theme, value, this.cellPx, this.dpr);
      this.sprites.set(value, sprite);
    }
    return sprite;
  }
}

/**
 * Render a single tile face into an offscreen canvas. The sprite is sized
 * generously so the glow halo isn't clipped and so peak-merge scaling
 * stays sharp. The "tile body" is centered inside.
 */
function renderTileSprite(
  theme: Theme,
  value: number,
  cellPx: number,
  dpr: number,
): HTMLCanvasElement {
  const skin = skinFor(theme, value);

  // Sprite is larger than the cell to give the glow blur room to fade out
  // and to keep the max-scale pulse sharp.
  const spriteCss = cellPx * 1.18 * 1.3;
  const spritePx = Math.ceil(spriteCss * dpr);

  const canvas = document.createElement("canvas");
  canvas.width = spritePx;
  canvas.height = spritePx;

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);

  // The body lives centered inside the oversized sprite.
  const s = cellPx;
  const cx = spriteCss / 2;
  const cy = spriteCss / 2;
  const tx = cx - s / 2;
  const ty = cy - s / 2;
  const r = s * 0.14;

  // Outer glow.
  ctx.shadowColor = skin.glow;
  ctx.shadowBlur = s * 0.28;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // Body gradient.
  const grad = ctx.createLinearGradient(tx, ty, tx, ty + s);
  grad.addColorStop(0, skin.from);
  grad.addColorStop(1, skin.to);
  roundRect(ctx, tx, ty, s, s, r);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Glassy highlight band on top half.
  const hl = ctx.createLinearGradient(tx, ty, tx, ty + s * 0.55);
  hl.addColorStop(0, "rgba(255,255,255,0.22)");
  hl.addColorStop(1, "rgba(255,255,255,0)");
  roundRect(ctx, tx + s * 0.06, ty + s * 0.06, s * 0.88, s * 0.45, r * 0.8);
  ctx.fillStyle = hl;
  ctx.fill();

  // Border.
  roundRect(ctx, tx + 0.5, ty + 0.5, s - 1, s - 1, r);
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Number.
  const text = String(value);
  const fontSize = fontSizeFor(text, s);
  ctx.fillStyle = skin.fg;
  ctx.font = `800 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "SF Pro Display", "Segoe UI", Roboto, Inter, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy + fontSize * 0.04);

  return canvas;
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

function fontSizeFor(text: string, tileSize: number): number {
  const base = tileSize * 0.42;
  if (text.length <= 2) return base;
  if (text.length === 3) return base * 0.82;
  if (text.length === 4) return base * 0.7;
  return base * 0.58;
}
