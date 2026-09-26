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
self.onmessage = async ({ data }) => {
  const { id, operation, pixels, corners, filter } = data;
  const allocated = [];
  const own = (m) => (allocated.push(m), m);
  try {
    const cv = await getCV();
    const src = own(cv.matFromImageData(pixels));
    let result;
    if (operation === "detect") {
      const gray = own(new cv.Mat()),
        blur = own(new cv.Mat()),
        edges = own(new cv.Mat()),
        binary = own(new cv.Mat());
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      const brightness = cv.mean(gray)[0];
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      cv.Canny(blur, edges, 45, 140);
      const kernel = own(
        cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)),
      );
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      cv.threshold(blur, binary, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      let best = null,
        bestScore = 0;
      const full = src.cols * src.rows;
      for (const mask of [edges, binary]) {
        const contours = own(new cv.MatVector()),
          hierarchy = own(new cv.Mat());
        cv.findContours(
          mask,
          contours,
          hierarchy,
          cv.RETR_LIST,
          cv.CHAIN_APPROX_SIMPLE,
        );
        for (let i = 0; i < contours.size(); i++) {
          const c = contours.get(i),
            poly = new cv.Mat();
          try {
            const area = cv.contourArea(c);
            if (area < full * 0.08 || area > full * 0.985) continue;
            cv.approxPolyDP(c, poly, 0.02 * cv.arcLength(c, true), true);
            if (poly.rows !== 4 || !cv.isContourConvex(poly)) continue;
            let pts = [];
            for (let j = 0; j < 4; j++)
              pts.push({
                x: poly.data32S[j * 2] / src.cols,
                y: poly.data32S[j * 2 + 1] / src.rows,
              });
            const center = pts.reduce(
              (a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }),
              { x: 0, y: 0 },
            );
            pts.sort(
              (a, b) =>
                Math.atan2(a.y - center.y, a.x - center.x) -
                Math.atan2(b.y - center.y, b.x - center.x),
            );
            const first = pts.reduce(
              (a, p, j) => (p.x + p.y < pts[a].x + pts[a].y ? j : a),
              0,
            );
            pts = [...pts.slice(first), ...pts.slice(0, first)];
            const border = pts.filter(
              (p) => p.x < 0.01 || p.y < 0.01 || p.x > 0.99 || p.y > 0.99,
            ).length;
            const score = area * (1 - border * 0.12);
            if (score > bestScore) {
              best = pts;
              bestScore = score;
            }
          } finally {
            c.delete();
            poly.delete();
          }
        }
      }
      self.postMessage({
        id,
        result: {
          corners: best || [
            { x: 0.06, y: 0.06 },
            { x: 0.94, y: 0.06 },
            { x: 0.94, y: 0.94 },
            { x: 0.06, y: 0.94 },
          ],
          detected: !!best,
          dark: brightness < 65,
        },
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
