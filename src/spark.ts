/** The 7-day line's maths: points for an SVG polyline, and which way the week went. */

/**
 * "x,y x,y …" for `values` spread across width × height, highest at the top, with `pad` units free above
 * and below so the stroke is never cut. A line that never moves sits in the middle.
 */
export function points(values: number[], width: number, height: number, pad: number): string {
  const low = Math.min(...values);
  const span = Math.max(...values) - low;
  const step = width / Math.max(1, values.length - 1);
  const round = (n: number): number => Math.round(n * 100) / 100;
  return values
    .map((value, at) => `${round(at * step)},${round(span ? pad + (1 - (value - low) / span) * (height - 2 * pad) : height / 2)}`)
    .join(' ');
}

/** The week's direction, from the first point to the last. */
export function trend(values: number[]): 'up' | 'down' | 'flat' {
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  return last > first ? 'up' : last < first ? 'down' : 'flat';
}
