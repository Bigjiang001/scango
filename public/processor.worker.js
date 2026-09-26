/* OpenCV runs off the UI thread. All input/output coordinates are normalized. */
let ready;
async function getCV() {
  if (!ready)
    ready = new Promise((resolve, reject) => {
      try {
        importScripts("./opencv.js");
        Promise.resolve(self.cv).then(resolve, reject);
      } catch (e) {
        reject(e);
      }
    });
  return ready;
}
/** Rank whole-sheet candidates using content, perimeter contrast and the camera guide. */
function locateDocument(cv, src, guide, own) {
  const gray = own(new cv.Mat()),
    blur = own(new cv.Mat());
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
  const width = src.cols,
    height = src.rows,
    full = width * height;
  const sample = (x, y) =>
    gray.data[
      Math.max(0, Math.min(height - 1, Math.round(y))) * width +
        Math.max(0, Math.min(width - 1, Math.round(x)))
    ];
  const inside = (p, quad) =>
    quad.every((a, i) => {
      const b = quad[(i + 1) % 4];
      return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
    });
  const areaOf = (p) =>
    Math.abs(
      p.reduce(
        (s, a, i) => s + a.x * p[(i + 1) % 4].y - a.y * p[(i + 1) % 4].x,
        0,
      ),
    ) / 2;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const expected = guide?.map((p) => ({ x: p.x * width, y: p.y * height }));
  const center = expected
    ? expected.reduce((a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }), {
        x: 0,
        y: 0,
      })
    : { x: width / 2, y: height / 2 };
  // Black-hat removes slowly varying illumination and isolates dark strokes.
  const ink = own(new cv.Mat()),
    inkKernel = own(
      cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(17, 17)),
    );
  cv.morphologyEx(gray, ink, cv.MORPH_BLACKHAT, inkKernel);
  cv.threshold(ink, ink, 18, 255, cv.THRESH_BINARY);
  const inkContours = own(new cv.MatVector()),
    inkHierarchy = own(new cv.Mat());
  cv.findContours(
    ink,
    inkContours,
    inkHierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );
  const strokes = [];
  for (let i = 0; i < inkContours.size(); i++) {
    const c = inkContours.get(i);
    try {
      const r = cv.boundingRect(c),
        a = cv.contourArea(c);
      if (
        a < 4 ||
        a > full * 0.008 ||
        r.height > height * 0.12 ||
        r.width > width * 0.72 ||
        r.width < 2 ||
        r.height < 2
      )
        continue;
      const p = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      if (sample(p.x, p.y) > 245) continue;
      const inGuide = !expected || inside(p, expected);
      strokes.push({
        ...p,
        weight: Math.min(50, Math.sqrt(a)) * (inGuide ? 1 : 0.12),
      });
    } finally {
      c.delete();
    }
  }
  const totalInk = strokes.reduce((s, p) => s + p.weight, 0);
  const candidates = [];
  const kernel = own(
    cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)),
  );
  // Different masks recover faint paper edges, shadows and interrupted outlines.
  for (const mode of ["edge-low", "edge", "otsu", "light", "mid"]) {
    const mask = new cv.Mat(),
      contours = new cv.MatVector(),
      hierarchy = new cv.Mat();
    try {
      if (mode.startsWith("edge")) {
        cv.Canny(
          blur,
          mask,
          mode === "edge" ? 45 : 12,
          mode === "edge" ? 140 : 50,
        );
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
      } else {
        cv.threshold(
          blur,
          mask,
          mode === "light" ? 200 : mode === "mid" ? 145 : 0,
          255,
          cv.THRESH_BINARY + (mode === "otsu" ? cv.THRESH_OTSU : 0),
        );
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);
      }
      cv.findContours(
        mask,
        contours,
        hierarchy,
        cv.RETR_LIST,
        cv.CHAIN_APPROX_SIMPLE,
      );
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i),
          poly = new cv.Mat(),
          hull = new cv.Mat();
        try {
          if (cv.contourArea(c) < full * 0.12) continue;
          cv.convexHull(c, hull);
          for (const epsilon of [0.015, 0.025, 0.04]) {
            cv.approxPolyDP(
              hull,
              poly,
              epsilon * cv.arcLength(hull, true),
              true,
            );
            if (poly.rows !== 4 || !cv.isContourConvex(poly)) continue;
            let points = Array.from({ length: 4 }, (_, j) => ({
              x: poly.data32S[j * 2],
              y: poly.data32S[j * 2 + 1],
            }));
            const mid = points.reduce(
              (s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }),
              { x: 0, y: 0 },
            );
            points.sort(
              (a, b) =>
                Math.atan2(a.y - mid.y, a.x - mid.x) -
                Math.atan2(b.y - mid.y, b.x - mid.x),
            );
            const first = points.reduce(
              (a, p, j) => (p.x + p.y < points[a].x + points[a].y ? j : a),
              0,
            );
            points = [...points.slice(first), ...points.slice(0, first)];
            const area = areaOf(points) / full;
            if (area < 0.12 || area > 0.96) continue;
            if (
              candidates.some((c) =>
                c.points.every(
                  (p, j) =>
                    dist(p, points[j]) < Math.max(width, height) * 0.022,
                ),
              )
            )
              continue;
            const sides = points.map((p, j) => dist(p, points[(j + 1) % 4]));
            const w = (sides[0] + sides[2]) / 2,
              h = (sides[1] + sides[3]) / 2,
              ratio = Math.min(w, h) / Math.max(w, h);
            if (ratio < 0.25 || Math.min(...sides) / Math.max(...sides) < 0.18)
              continue;
            // A contour around the entire photograph is not evidence of a sheet.
            const border = points.filter(
              (p) => p.x < 3 || p.y < 3 || p.x > width - 4 || p.y > height - 4,
            ).length;
            if (border >= 3) continue;
            let contrast = 0,
              edgeSupport = 0,
              edgeSamples = 0;
            for (let j = 0; j < 4; j++) {
              const a = points[j],
                b = points[(j + 1) % 4],
                length = dist(a, b),
                nx = -(b.y - a.y) / length,
                ny = (b.x - a.x) / length;
              for (let t = 0.1; t < 1; t += 0.1) {
                const x = a.x + (b.x - a.x) * t,
                  y = a.y + (b.y - a.y) * t;
                const delta =
                  sample(x + nx * 5, y + ny * 5) -
                  sample(x - nx * 5, y - ny * 5);
                contrast += Math.max(0, delta);
                if (delta > 8) edgeSupport++;
                edgeSamples++;
              }
            }
            contrast /= edgeSamples;
            edgeSupport /= edgeSamples;
            let paper = 0,
              count = 0;
            for (let y = 0.15; y < 0.95; y += 0.14)
              for (let x = 0.15; x < 0.95; x += 0.14) {
                const top = {
                    x: points[0].x * (1 - x) + points[1].x * x,
                    y: points[0].y * (1 - x) + points[1].y * x,
                  },
                  bottom = {
                    x: points[3].x * (1 - x) + points[2].x * x,
                    y: points[3].y * (1 - x) + points[2].y * x,
                  };
                if (
                  sample(
                    top.x * (1 - y) + bottom.x * y,
                    top.y * (1 - y) + bottom.y * y,
                  ) > 110
                )
                  paper++;
                count++;
              }
            const lightness = paper / count;
            const included = strokes
              .filter((p) => inside(p, points))
              .reduce((s, p) => s + p.weight, 0);
            const coverage = totalInk > 0 ? included / totalInk : 0;
            const centrality = Math.max(
              0,
              1 - dist(mid, center) / (Math.hypot(width, height) * 0.5),
            );
            let guideOverlap = 0;
            if (expected) {
              let hits = 0;
              for (let gy = 0; gy < 7; gy++)
                for (let gx = 0; gx < 7; gx++) {
                  const p = {
                    x:
                      expected[0].x +
                      ((expected[1].x - expected[0].x) * (gx + 0.5)) / 7,
                    y:
                      expected[0].y +
                      ((expected[3].y - expected[0].y) * (gy + 0.5)) / 7,
                  };
                  if (inside(p, points)) hits++;
                }
              guideOverlap = hits / 49;
            }
            const shape = Math.max(0, 1 - Math.abs(ratio - 0.707) / 0.5);
            const score =
              0.13 * area +
              0.09 * centrality +
              0.06 * shape +
              0.1 * lightness +
              0.16 * edgeSupport +
              0.11 * Math.min(1, contrast / 55) +
              (totalInk > 15 ? 0.35 * coverage : 0) +
              (expected ? 0.18 * guideOverlap : 0) -
              border * 0.05;
            const credible =
              lightness > 0.5 &&
              edgeSupport > 0.22 &&
              contrast > 5 &&
              (!expected || guideOverlap > 0.45) &&
              (totalInk < 15 || coverage > 0.45);
            candidates.push({ points, score, credible, coverage, contrast });
          }
        } finally {
          c.delete();
          poly.delete();
          hull.delete();
        }
      }
    } finally {
      mask.delete();
      contours.delete();
      hierarchy.delete();
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates.find(
    (c) => c.credible && c.score > (expected ? 0.53 : 0.47),
  );
  const normalize = (c) =>
    c.points.map((p) => ({ x: p.x / width, y: p.y / height }));
  const fallback = guide || [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const alternatives = candidates
    .filter((c) => c.credible)
    .slice(0, 4)
    .map(normalize);
  return {
    corners: best ? normalize(best) : fallback,
    detected: !!best,
    dark: cv.mean(gray)[0] < 65,
    alternatives,
    confidence: best ? Math.min(1, best.score) : 0,
  };
}

self.onmessage = async ({ data }) => {
  const { id, operation, pixels, corners, filter } = data;
  const allocated = [];
  const own = (m) => (allocated.push(m), m);
  try {
    const cv = await getCV();
    const src = own(cv.matFromImageData(pixels));
    let result;
    if (operation === "detect") {
      self.postMessage({
        id,
        result: locateDocument(cv, src, data.guide, own),
      });
      return;
    }

    if (operation === "warp") {
      const pts = corners.map((p) => ({
        x: p.x * (src.cols - 1),
        y: p.y * (src.rows - 1),
      }));
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      let w = Math.max(dist(pts[0], pts[1]), dist(pts[3], pts[2])),
        h = Math.max(dist(pts[0], pts[3]), dist(pts[1], pts[2]));
      if (data.paperFormat === "a4" || data.paperFormat === "a4-landscape") {
        const longest = Math.max(w, h);
        const ratio = data.paperFormat === "a4" ? 1 / Math.SQRT2 : Math.SQRT2;
        w = ratio > 1 ? longest : longest * ratio;
        h = ratio > 1 ? longest / ratio : longest;
      }
      const scale = Math.min(1, 2600 / Math.max(w, h));
      w = Math.max(2, Math.round(w * scale));
      h = Math.max(2, Math.round(h * scale));
      const a = own(
          cv.matFromArray(
            4,
            1,
            cv.CV_32FC2,
            pts.flatMap((p) => [p.x, p.y]),
          ),
        ),
        b = own(
          cv.matFromArray(4, 1, cv.CV_32FC2, [
            0,
            0,
            w - 1,
            0,
            w - 1,
            h - 1,
            0,
            h - 1,
          ]),
        );
      const transform = own(cv.getPerspectiveTransform(a, b));
      result = own(new cv.Mat());
      cv.warpPerspective(
        src,
        result,
        transform,
        new cv.Size(w, h),
        cv.INTER_CUBIC,
        cv.BORDER_REPLICATE,
      );
    } else if (operation === "filter") {
      result = own(new cv.Mat());
      if (filter === "original") src.copyTo(result);
      else {
        const gray = own(new cv.Mat());
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        if (filter === "gray") cv.cvtColor(gray, result, cv.COLOR_GRAY2RGBA);
        else if (filter === "bw") {
          const temp = own(new cv.Mat());
          cv.GaussianBlur(gray, temp, new cv.Size(3, 3), 0);
          const block = Math.max(
            15,
            Math.min(61, Math.floor(Math.min(src.cols, src.rows) / 30) * 2 + 1),
          );
          cv.adaptiveThreshold(
            temp,
            temp,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            block,
            12,
          );
          cv.cvtColor(temp, result, cv.COLOR_GRAY2RGBA);
        } else {
          const small = own(new cv.Mat()),
            background = own(new cv.Mat());
          cv.resize(
            gray,
            small,
            new cv.Size(
              Math.max(2, Math.round(src.cols / 12)),
              Math.max(2, Math.round(src.rows / 12)),
            ),
          );
          cv.GaussianBlur(small, small, new cv.Size(0, 0), 7);
          cv.resize(
            small,
            background,
            new cv.Size(src.cols, src.rows),
            0,
            0,
            cv.INTER_LINEAR,
          );
          src.copyTo(result);
          const hist = [
            new Uint32Array(256),
            new Uint32Array(256),
            new Uint32Array(256),
          ];
          let count = 0;
          for (let i = 0; i < src.data.length; i += 16) {
            for (let c = 0; c < 3; c++) hist[c][src.data[i + c]]++;
            count++;
          }
          const white = hist.map((a) => {
            let n = 0;
            for (let j = 0; j < 256; j++) {
              n += a[j];
              if (n >= count * 0.96) return Math.max(160, j);
            }
            return 255;
          });
          for (let i = 0, p = 0; i < result.data.length; i += 4, p++) {
            const gain = Math.min(
              1.65,
              Math.max(0.92, 238 / Math.max(90, background.data[p])),
            );
            for (let c = 0; c < 3; c++) {
              const balanced =
                src.data[i + c] * (filter === "auto" ? 255 / white[c] : 1);
              const value =
                balanced * (filter === "auto" ? gain : 1 + (gain - 1) * 0.5);
              result.data[i + c] = Math.max(
                0,
                Math.min(
                  255,
                  (value - 128) * (filter === "auto" ? 1.14 : 1.2) + 128,
                ),
              );
            }
          }
          const softened = own(new cv.Mat());
          cv.GaussianBlur(result, softened, new cv.Size(0, 0), 1);
          cv.addWeighted(result, 1.35, softened, -0.35, 0, result);
        }
      }
    } else throw new Error("未知的图像处理操作");
    const output = new Uint8ClampedArray(result.data);
    self.postMessage(
      { id, result: { data: output, width: result.cols, height: result.rows } },
      [output.buffer],
    );
  } catch (e) {
    self.postMessage({
      id,
      error:
        typeof e === "number"
          ? "图像处理失败，请尝试较小的图片或重新拍摄。"
          : e.message || String(e),
    });
  } finally {
    for (let i = allocated.length - 1; i >= 0; i--) allocated[i].delete();
  }
};
