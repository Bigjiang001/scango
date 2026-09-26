export const paperSizes = [
  { id: "a3", label: "A3", width: 297, height: 420 },
  { id: "a4", label: "A4", width: 210, height: 297 },
  { id: "a5", label: "A5", width: 148, height: 210 },
  { id: "b5", label: "B5（ISO）", width: 176, height: 250 },
  { id: "letter", label: "Letter", width: 215.9, height: 279.4 },
  { id: "legal", label: "Legal", width: 215.9, height: 355.6 },
] as const;
export type PaperId = (typeof paperSizes)[number]["id"];
export type PageFormat =
  PaperId | `${PaperId}-landscape` | "original" | "custom";
export interface ExportOptions {
  pageFormat: PageFormat;
  marginMm: 0 | 5 | 10;
  customWidthMm?: number;
  customHeightMm?: number;
}
export const defaultExportOptions: ExportOptions = {
  pageFormat: "original",
  marginMm: 0,
};
export function paperDimensions(
  options: ExportOptions,
): [number, number] | undefined {
  if (options.pageFormat === "original") return undefined;
  if (options.pageFormat === "custom") {
    const w = options.customWidthMm ?? 210,
      h = options.customHeightMm ?? 297;
    if (
      !Number.isFinite(w) ||
      !Number.isFinite(h) ||
      w < 20 ||
      h < 20 ||
      w > 2000 ||
      h > 2000
    )
      throw new Error("自定义宽高需在 20–2000 mm 之间");
    return [w, h];
  }
  const landscape = options.pageFormat.endsWith("-landscape");
  const paper = paperSizes.find(
    (p) => p.id === options.pageFormat.replace("-landscape", ""),
  );
  if (!paper) throw new Error("请选择有效的纸张尺寸");
  return landscape ? [paper.height, paper.width] : [paper.width, paper.height];
}
export function pageLayout(
  width: number,
  height: number,
  options: ExportOptions = defaultExportOptions,
) {
  if (!(width > 0 && height > 0)) throw new Error("无效的页面尺寸");
  const ratio = width / height,
    mm = paperDimensions(options);
  const size: [number, number] = mm
    ? [
        Math.round(((mm[0] * 72) / 25.4) * 100) / 100,
        Math.round(((mm[1] * 72) / 25.4) * 100) / 100,
      ]
    : ratio > 1
      ? [841.89, 841.89 / ratio]
      : [841.89 * ratio, 841.89];
  const margin = Math.min(
    (options.marginMm * 72) / 25.4,
    Math.min(...size) * 0.2,
  );
  const scale = Math.min(
    (size[0] - margin * 2) / width,
    (size[1] - margin * 2) / height,
  );
  const imageWidth = width * scale,
    imageHeight = height * scale;
  return {
    size,
    x: Math.max(0, (size[0] - imageWidth) / 2),
    y: Math.max(0, (size[1] - imageHeight) / 2),
    width: imageWidth,
    height: imageHeight,
  };
}
