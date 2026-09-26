import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
async function load(path) {
  const js = ts.transpileModule(
    fs.readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  return import(
    "data:text/javascript;base64," + Buffer.from(js).toString("base64")
  );
}
const { pageLayout, paperSizes, paperDimensions, defaultExportOptions } =
  await load("../src/utils/pdfLayout.ts");
for (const format of ["a4", "a4-landscape", "original"])
  for (const margin of [0, 5, 10])
    for (const [w, h] of [
      [1000, 1400],
      [1400, 1000],
      [500, 2200],
      [2200, 500],
      [800, 800],
    ]) {
      const layout = pageLayout(w, h, { pageFormat: format, marginMm: margin });
      if (format === "a4") assert.deepEqual(layout.size, [595.28, 841.89]);
      if (format === "a4-landscape")
        assert.deepEqual(layout.size, [841.89, 595.28]);
      if (format === "original")
        assert.ok(Math.abs(layout.size[0] / layout.size[1] - w / h) < 1e-8);
      assert.ok(
        Math.abs(layout.width / layout.height - w / h) < 1e-8,
        "No stretching",
      );
      assert.ok(
        layout.x >= 0 &&
          layout.y >= 0 &&
          layout.x + layout.width <= layout.size[0] + 1e-7 &&
          layout.y + layout.height <= layout.size[1] + 1e-7,
        "No clipping",
      );
      assert.ok(
        Math.abs(layout.x * 2 + layout.width - layout.size[0]) < 1e-7,
        "Centered",
      );
    }
console.log(
  "PASS: 45 PDF layout combinations, uniform A4 dimensions, margins, aspect ratio, centering and no clipping",
);
const { cameraGuide } = await load("../src/utils/cameraGuide.ts");
for (const [vw, vh] of [
  [1920, 1080],
  [1080, 1920],
  [2560, 1920],
])
  for (const [bw, bh] of [
    [320, 600],
    [844, 260],
    [768, 800],
  ])
    for (const landscape of [true, false]) {
      const g = cameraGuide(vw, vh, bw, bh, landscape);
      const scale = Math.min(bw / vw, bh / vh),
        left = (bw - vw * scale) / 2,
        top = (bh - vh * scale) / 2;
      assert.ok(Math.abs(left + g.corners[0].x * vw * scale - g.left) < 1e-7);
      assert.ok(Math.abs(top + g.corners[0].y * vh * scale - g.top) < 1e-7);
      assert.ok(
        Math.abs(
          g.width / g.height - (landscape ? Math.SQRT2 : 1 / Math.SQRT2),
        ) < 1e-7,
      );
      assert.ok(
        g.corners.every((p) => p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1),
      );
    }
console.log("PASS: 18 portrait/landscape/letterbox camera guide mappings");

assert.equal(defaultExportOptions.pageFormat, "original");
for (const paper of paperSizes)
  for (const landscape of [false, true]) {
    const options = {
      pageFormat: paper.id + (landscape ? "-landscape" : ""),
      marginMm: 5,
    };
    const mm = landscape
      ? [paper.height, paper.width]
      : [paper.width, paper.height];
    assert.deepEqual(paperDimensions(options), mm);
    for (const [w, h] of [
      [700, 1100],
      [1100, 700],
    ]) {
      const layout = pageLayout(w, h, options);
      assert.deepEqual(
        layout.size,
        mm.map((v) => Math.round(((v * 72) / 25.4) * 100) / 100),
      );
      assert.ok(Math.abs(layout.width / layout.height - w / h) < 1e-8);
    }
  }
assert.deepEqual(
  pageLayout(800, 1200, {
    pageFormat: "custom",
    marginMm: 0,
    customWidthMm: 100,
    customHeightMm: 180,
  }).size,
  [283.46, 510.24],
);
for (const n of [0, 19, 2001, NaN, Infinity])
  assert.throws(() =>
    paperDimensions({
      pageFormat: "custom",
      customWidthMm: n,
      customHeightMm: 180,
    }),
  );
console.log(
  "PASS: 12 standard paper orientations, custom dimensions, invalid sizes, and free-size default",
);
