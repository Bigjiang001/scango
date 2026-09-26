import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const cv = await require("@techstark/opencv-js");
let response;
const scope = {
  self: {
    cv,
    postMessage: (r) => {
      response = r;
    },
  },
  importScripts: () => {},
  console,
  Uint8ClampedArray,
  Uint32Array,
};
vm.createContext(scope);
vm.runInContext(
  fs.readFileSync(
    new URL("../public/processor.worker.js", import.meta.url),
    "utf8",
  ),
  scope,
);
async function run(operation, pixels, extra = {}) {
  await scope.self.onmessage({ data: { id: 1, operation, pixels, ...extra } });
  if (response.error) throw new Error(response.error);
  return response.result;
}
const source = new cv.Mat(900, 700, cv.CV_8UC4, new cv.Scalar(38, 46, 57, 255));
const quad = cv.matFromArray(
  4,
  1,
  cv.CV_32SC2,
  [130, 70, 635, 135, 565, 840, 55, 780],
);
cv.fillConvexPoly(source, quad, new cv.Scalar(232, 230, 224, 255));
for (let y = 210; y < 700; y += 55)
  cv.line(
    source,
    new cv.Point(150, y),
    new cv.Point(505, y + 25),
    new cv.Scalar(35, 35, 35, 255),
    5,
  );
const pixels = {
  data: new Uint8ClampedArray(source.data),
  width: 700,
  height: 900,
};
const result = await run("detect", pixels);
assert.equal(result.detected, true);
const expected = [
  [130 / 700, 70 / 900],
  [635 / 700, 135 / 900],
  [565 / 700, 840 / 900],
  [55 / 700, 780 / 900],
];
result.corners.forEach((p, i) =>
  assert.ok(
    Math.hypot(p.x - expected[i][0], p.y - expected[i][1]) < 0.025,
    "Detected corner outside tolerance",
  ),
);
console.log("PASS: four detected corners within 2.5% of ground truth");
const warped = await run("warp", pixels, { corners: result.corners });
assert.ok(warped.width > 490 && warped.width < 530);
assert.ok(warped.height > 680 && warped.height < 740);
assert.equal(warped.data.length, warped.width * warped.height * 4);
console.log("PASS: perspective output dimensions and RGBA buffer");
for (const filter of ["original", "auto", "color", "gray", "bw"]) {
  const r = await run("filter", warped, { filter });
  assert.equal(r.width, warped.width);
  assert.equal(r.height, warped.height);
  if (filter === "gray" || filter === "bw")
    for (let i = 0; i < r.data.length; i += 4) {
      assert.equal(r.data[i], r.data[i + 1]);
      assert.equal(r.data[i], r.data[i + 2]);
      if (filter === "bw") assert.ok(r.data[i] === 0 || r.data[i] === 255);
    }
  if (filter === "original") assert.deepEqual(r.data, warped.data);
  console.log("PASS: " + filter);
}
const blank = new cv.Mat(500, 500, cv.CV_8UC4, new cv.Scalar(25, 25, 25, 255));
const fallback = await run("detect", {
  data: new Uint8ClampedArray(blank.data),
  width: 500,
  height: 500,
});
assert.equal(fallback.detected, false);
assert.equal(fallback.dark, true);
assert.equal(fallback.corners.length, 4);
console.log("PASS: dark/blank image manual-crop fallback");
source.delete();
quad.delete();
blank.delete();
console.log(
  "Image pipeline checks passed. Synthetic fixtures do not replace real-device testing.",
);

function rgba(mat) {
  return {
    data: new Uint8ClampedArray(mat.data),
    width: mat.cols,
    height: mat.rows,
  };
}
function sheet(mat, x, y, w, h, tone = 238, text = true) {
  cv.rectangle(
    mat,
    new cv.Point(x, y),
    new cv.Point(x + w, y + h),
    new cv.Scalar(tone, tone, tone, 255),
    -1,
  );
  if (text)
    for (let line = y + 45; line < y + h - 35; line += 42)
      cv.line(
        mat,
        new cv.Point(x + 25, line),
        new cv.Point(x + w - 30, line + 2),
        new cv.Scalar(35, 35, 35, 255),
        3,
      );
}
const competing = new cv.Mat(
  900,
  1000,
  cv.CV_8UC4,
  new cv.Scalar(60, 60, 60, 255),
);
sheet(competing, 20, 20, 450, 840, 245, false);
sheet(competing, 535, 145, 430, 615);
const chosen = await run("detect", rgba(competing));
assert.equal(chosen.detected, true);
assert.ok(
  chosen.corners.every((p) => p.x > 0.5),
  "Larger empty rectangle must not win over a text document",
);
console.log("PASS: text document wins over larger blank rectangle");
competing.delete();
const faint = new cv.Mat(
  900,
  700,
  cv.CV_8UC4,
  new cv.Scalar(216, 216, 216, 255),
);
sheet(faint, 90, 90, 520, 735, 237);
const faintResult = await run("detect", rgba(faint));
assert.equal(faintResult.detected, true);
assert.ok(Math.abs(faintResult.corners[0].x - 90 / 700) < 0.035);
console.log("PASS: low-contrast sheet outline");
faint.delete();
const noEdges = new cv.Mat(
  900,
  700,
  cv.CV_8UC4,
  new cv.Scalar(240, 240, 240, 255),
);
cv.rectangle(
  noEdges,
  new cv.Point(140, 240),
  new cv.Point(560, 650),
  new cv.Scalar(30, 30, 30, 255),
  3,
);
for (let y = 280; y < 620; y += 40)
  cv.line(
    noEdges,
    new cv.Point(140, y),
    new cv.Point(560, y),
    new cv.Scalar(30, 30, 30, 255),
    2,
  );
const manual = await run("detect", rgba(noEdges));
assert.equal(
  manual.detected,
  false,
  "A table border inside paper must not become the sheet",
);
assert.equal(manual.corners[0].x, 0);
assert.equal(manual.corners[2].x, 1);
console.log("PASS: no reliable outline preserves whole photograph");
noEdges.delete();
const guided = new cv.Mat(
  900,
  1200,
  cv.CV_8UC4,
  new cv.Scalar(50, 50, 50, 255),
);
sheet(guided, 420, 210, 320, 460);
sheet(guided, 810, 40, 370, 800);
const guide = [
  { x: 420 / 1200, y: 210 / 900 },
  { x: 740 / 1200, y: 210 / 900 },
  { x: 740 / 1200, y: 670 / 900 },
  { x: 420 / 1200, y: 670 / 900 },
];
const focused = await run("detect", rgba(guided), { guide });
assert.equal(focused.detected, true);
assert.ok(
  focused.corners.every((p) => p.x < 0.65),
  "Ignore competing document outside camera guide",
);
console.log("PASS: camera guide prioritizes intended sheet");
guided.delete();
const a4Warp = await run("warp", pixels, {
  corners: result.corners,
  paperFormat: "a4",
});
assert.ok(Math.abs(a4Warp.width / a4Warp.height - 1 / Math.SQRT2) < 0.002);
const wideWarp = await run("warp", pixels, {
  corners: result.corners,
  paperFormat: "a4-landscape",
});
assert.ok(Math.abs(wideWarp.width / wideWarp.height - Math.SQRT2) < 0.003);
console.log(
  "PASS: A4 portrait/landscape perspective targets preserve all four source corners",
);
