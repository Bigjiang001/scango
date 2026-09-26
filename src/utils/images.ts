export async function decode(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new Error(
      "无法读取图片，请使用 JPEG、PNG 或此浏览器支持的照片格式。",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  quality = 0.9,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(new Error("无法编码图片，请释放设备空间后重试。")),
      "image/jpeg",
      quality,
    ),
  );
}
export async function resize(blob: Blob, max = 2400, quality = 0.9) {
  const img = await decode(blob);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return {
    blob: await canvasBlob(canvas, quality),
    width: canvas.width,
    height: canvas.height,
  };
}
export async function rotateImage(blob: Blob) {
  const img = await decode(blob);
  const c = document.createElement("canvas");
  c.width = img.height;
  c.height = img.width;
  const ctx = c.getContext("2d")!;
  ctx.translate(c.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, 0, 0);
  return { blob: await canvasBlob(c), width: c.width, height: c.height };
}
export function fileName(value: string) {
  return (
    (value
      .trim()
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .slice(0, 100) || "茜茜扫描") + ".pdf"
  );
}
