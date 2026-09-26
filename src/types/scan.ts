import type { ExportOptions, PageFormat } from "../utils/pdfLayout";
export type Point = { x: number; y: number };
export type Corners = [Point, Point, Point, Point];
export type Filter = "original" | "auto" | "color" | "gray" | "bw";
export interface ScanPage {
  id: string;
  originalImage: Blob;
  processedImage: Blob;
  thumbnail: Blob;
  corners: Corners;
  rotation: number;
  cropFormat?: PageFormat;
  filter: Filter;
  width: number;
  height: number;
}
export interface ScanDocument {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  pages: ScanPage[];
  exportOptions?: ExportOptions;
  pdfInfo?: {
    blob: Blob;
    quality: "standard" | "high";
    generatedAt: number;
    layoutVersion?: number;
  };
}
export const filters: { id: Filter; label: string; note: string }[] = [
  { id: "original", label: "原图", note: "保留原始色彩" },
  { id: "auto", label: "自动增强", note: "提亮纸张 · 清晰文字" },
  { id: "bw", label: "黑白扫描", note: "自适应去阴影 · 黑白文字" },
  { id: "gray", label: "灰度", note: "柔和灰阶 · 保留细节" },
  { id: "color", label: "彩色增强", note: "保留彩色 · 提升对比" },
];

export interface DetectionResult {
  corners: Corners;
  detected: boolean;
  dark: boolean;
  alternatives: Corners[];
  confidence: number;
}
