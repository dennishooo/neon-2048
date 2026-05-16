/**
 * Tile palette type.
 *
 * Concrete palettes live in `src/themes.ts` — one per theme.
 */
export interface TileSkin {
  from: string;
  to: string;
  glow: string;
  fg: string;
}
