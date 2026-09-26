import type { Corners } from "../types/scan";
/** Map the visible guide through object-fit:contain into source-image coordinates. */
export function cameraGuide(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
  landscape = false,
) {
  const scale = Math.min(boxWidth / videoWidth, boxHeight / videoHeight);
  const renderedWidth = videoWidth * scale,
    renderedHeight = videoHeight * scale;
  const ratio = landscape ? Math.SQRT2 : 1 / Math.SQRT2;
  const width = Math.min(renderedWidth * 0.84, renderedHeight * 0.84 * ratio),
    height = width / ratio;
  const left = (boxWidth - width) / 2,
    top = (boxHeight - height) / 2;
  const x = (renderedWidth - width) / 2 / renderedWidth,
    y = (renderedHeight - height) / 2 / renderedHeight;
  const corners: Corners = [
    { x, y },
    { x: 1 - x, y },
    { x: 1 - x, y: 1 - y },
    { x, y: 1 - y },
  ];
  return { left, top, width, height, corners };
}
