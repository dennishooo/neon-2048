/** Cubic ease-out — sharp start, soft landing. */
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Quintic ease-out — even punchier. */
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5);

/** Spring-y back-out (small overshoot). */
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
