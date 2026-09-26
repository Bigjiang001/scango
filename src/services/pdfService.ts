import { PDFDocument } from "pdf-lib";
import type { ScanDocument } from "../types/scan";
import { pageLayout } from "../utils/pdfLayout";
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
    const source =
      quality === "high"
        ? doc.pages[i].processedImage
        : (await resize(doc.pages[i].processedImage, 2400, 0.92)).blob;
    const bytes = await source.arrayBuffer();
    const img =
      source.type === "image/png"
        ? await pdf.embedPng(bytes)
        : await pdf.embedJpg(bytes);
    const layout = pageLayout(img.width, img.height, doc.exportOptions);
    const page = pdf.addPage(layout.size);
    page.drawImage(img, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height,
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
