import { paperDimensions, type PageFormat } from "../utils/pdfLayout";
import type { Corners, Filter, DetectionResult } from "../types/scan";
import { decode, canvasBlob } from "../utils/images";
let worker: Worker | undefined;
let sequence = 0;
const jobs = new Map<
  number,
  {
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();
function reset(message: string) {
  worker?.terminate();
  worker = undefined;
  for (const job of jobs.values()) {
    clearTimeout(job.timer);
    job.reject(new Error(message));
  }
  jobs.clear();
}
function getWorker() {
  if (!worker) {
    worker = new Worker(`${import.meta.env.BASE_URL}processor.worker.js`);
    worker.onmessage = ({ data }) => {
      const job = jobs.get(data.id);
      if (!job) return;
      clearTimeout(job.timer);
      jobs.delete(data.id);
      if (data.error) job.reject(new Error(data.error));
      else job.resolve(data.result);
    };
    worker.onerror = () => reset("图像引擎加载失败，请重新打开应用后重试。");
  }
  return worker;
}
async function pixels(blob: Blob, max: number) {
  const img = await decode(blob);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(img.width * scale));
  c.height = Math.max(2, Math.round(img.height * scale));
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return ctx.getImageData(0, 0, c.width, c.height);
}
async function run<T>(
  operation: string,
  blob: Blob,
  max: number,
  extra: object = {},
): Promise<T> {
  const input = await pixels(blob, max);
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const w = getWorker();
    const timer = setTimeout(
      () => reset("处理时间过长，请尝试更小的图片。"),
      90000,
    );
    jobs.set(id, { resolve: (v) => resolve(v as T), reject, timer });
    w.postMessage({ id, operation, pixels: input, ...extra }, [
      input.data.buffer,
    ]);
  });
}
export function detectDocument(blob: Blob, guide?: Corners) {
  return run<DetectionResult>("detect", blob, 1100, { guide });
}

async function output(operation: string, blob: Blob, extra: object) {
  const result = await run<{
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
  }>(operation, blob, 2600, extra);
  const c = document.createElement("canvas");
  c.width = result.width;
  c.height = result.height;
  c.getContext("2d")!.putImageData(
    new ImageData(result.data, result.width, result.height),
    0,
    0,
  );
  return { blob: await canvasBlob(c, 0.94), width: c.width, height: c.height };
}
export function correctPerspective(
  blob: Blob,
  corners: Corners,
  paperFormat: PageFormat = "original",
) {
  const mm = paperDimensions({ pageFormat: paperFormat, marginMm: 0 });
  return output("warp", blob, {
    corners,
    paperRatio: mm ? mm[0] / mm[1] : undefined,
  });
}
export function applyFilter(blob: Blob, filter: Filter) {
  return output("filter", blob, { filter });
}
