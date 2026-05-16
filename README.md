# Neon 2048

A high-performance, cross-platform 2048 with a glass/neon aesthetic. Pure
Canvas2D, no game framework, ~7 kB gzipped JS for the entire game.

- **Web** — runs in any modern browser, desktop or mobile.
- **Native** — packaged as a Tauri 2 app (macOS, Windows, Linux).
- **Inputs** — keyboard (arrows / WASD / hjkl), touch swipes, mouse drag.
- **Undo** — one-step undo, `Z` or the toolbar button.
- **Tests** — 19 engine + input tests with Vitest.

## Stack

- Vite 5 + TypeScript 5 (strict)
- Canvas2D renderer with device-pixel-ratio scaling, glow/gradient tiles,
  tweened slide + merge + spawn animations on `requestAnimationFrame`
- Tauri 2 (Rust 1.91, release profile: LTO, single codegen unit, panic = abort,
  symbol stripping)

## Run

### Web (browser)

```bash
npm install
npm run dev        # http://localhost:1420
npm run build      # production bundle into dist/
npm run preview    # serve the built bundle
```

### Native (Tauri)

```bash
npm install
npm run tauri:dev    # opens the native window
npm run tauri:build  # builds platform-native installers
```

Linux build deps (Ubuntu): `libwebkit2gtk-4.1-dev libappindicator3-dev
librsvg2-dev patchelf`.

## Controls

| Action       | Input                                             |
| ------------ | ------------------------------------------------- |
| Move tiles   | Arrows · `W A S D` · `h j k l` · swipe · drag     |
| Undo         | `Z` or **Undo** button                            |
| New game     | `R` or **New game** button                        |
| Keep playing | After 2048 you can dismiss the win overlay        |

## Architecture

```
src/
  engine/        pure TS — board state, moves, scoring, win/lose
    game.ts      move(), spawnTile(), hasMovesAvailable()
    rng.ts       mulberry32 seeded RNG (deterministic tests)
    types.ts
  render/        Canvas2D renderer
    renderer.ts  RAF loop, slide/merge/spawn tweens, hi-DPI
    palette.ts   per-tile-value gradients + glow
    easing.ts
  input.ts       pointer + keyboard, swipe detection
  storage.ts     best-score in localStorage
  main.ts        DOM glue: HUD, overlay, undo
src-tauri/       Tauri 2 shell
```

The engine never touches the DOM. Tile IDs are stable across moves so the
renderer can compute slide animations by diffing two states.

## Performance notes

- The renderer's RAF loop is **idle by default** — it only redraws while
  an animation is in flight or the state changed.
- Canvas backing store matches `devicePixelRatio` (capped at 3) so retina
  screens stay crisp without wasting pixels on absurd 4×.
- Production JS bundle: **~12.7 kB raw, ~5.3 kB gzipped**.
- Tauri release profile: LTO + `opt-level = "s"` for a small binary.

## CI

`.github/workflows/ci.yml` runs typecheck, tests, and Vite build on every
push and PR; the `native` job then cross-builds the Tauri app on macOS,
Linux, and Windows.

## License

MIT — do whatever you want.
