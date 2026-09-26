import type { Corners } from "../types/scan";
export function validCorners(p: Corners) {
  const cross = p.map((a, i) => {
    const b = p[(i + 1) % 4],
      c = p[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  });
  const area =
    Math.abs(
      p.reduce(
        (s, a, i) => s + a.x * p[(i + 1) % 4].y - a.y * p[(i + 1) % 4].x,
        0,
      ),
    ) / 2;
  return cross.every((n) => n > 0) && area > 0.015;
}
