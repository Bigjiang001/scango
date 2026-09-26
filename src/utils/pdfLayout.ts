export type PageFormat = "a4" | "a4-landscape" | "original";
export interface ExportOptions {
  pageFormat: PageFormat;
  marginMm: 0 | 5 | 10;
}
export const defaultExportOptions: ExportOptions = {
  pageFormat: "a4",
  marginMm: 5,
};
export function pageLayout(
  width: number,
  height: number,
  options: ExportOptions = defaultExportOptions,
) {
  if (!(width > 0 && height > 0)) throw new Error("无效的页面尺寸");
  const ratio = width / height;
  const size: [number, number] =
    options.pageFormat === "a4"
      ? [595.28, 841.89]
      : options.pageFormat === "a4-landscape"
        ? [841.89, 595.28]
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
