import { PDFDocument } from "pdf-lib";
import type { ScanDocument } from "../types/scan";
import { resize } from "../utils/images";
export async function generatePdf(
  doc: ScanDocument,
  quality: "standard" | "high",
  progress: (n: number) => void,
) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.name);
  pdf.setCreator("茜茜扫描");
  for (let i = 0; i < doc.pages.length; i++) {
    const source = await resize(
      doc.pages[i].processedImage,
      quality === "high" ? 2600 : 1600,
      quality === "high" ? 0.9 : 0.76,
    );
    const img = await pdf.embedJpg(await source.blob.arrayBuffer());
    const ratio = img.width / img.height;
    const a4 = Math.abs(Math.min(ratio, 1 / ratio) - 1 / Math.sqrt(2)) < 0.045;
    const size: [number, number] = a4
      ? ratio > 1
        ? [841.89, 595.28]
        : [595.28, 841.89]
      : ratio > 1
        ? [841.89, 841.89 / ratio]
        : [841.89 * ratio, 841.89];
    const page = pdf.addPage(size);
    const scale = Math.min(size[0] / img.width, size[1] / img.height);
    const w = img.width * scale,
      h = img.height * scale;
    page.drawImage(img, {
      x: (size[0] - w) / 2,
      y: (size[1] - h) / 2,
      width: w,
      height: h,
    });
    progress(Math.round(((i + 1) / doc.pages.length) * 100));
  }
  const bytes = await pdf.save();
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
export function downloadPdf(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
