import { useRef, useState } from "react";
import type { Corners, Point } from "../types/scan";
import { BlobImage } from "./BlobImage";
import { validCorners } from "../utils/geometry";
export function DocumentCropper({
  blob,
  corners,
  onChange,
}: {
  blob: Blob;
  corners: Corners;
  onChange: (corners: Corners) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  function move(i: number, p: Point) {
    const next = corners.map((c, n) => (n === i ? p : c)) as Corners;
    if (validCorners(next)) onChange(next);
  }
  return (
    <div className="crop-stage">
      <div className="crop-image" ref={box}>
        <BlobImage
          blob={blob}
          alt="拖动四个角，使裁剪框贴合纸张边缘"
          draggable={false}
        />
        <svg
          className="crop-overlay"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d={`M0 0H100V100H0Z M${corners.map((p) => `${p.x * 100} ${p.y * 100}`).join("L")}Z`}
            fill="#0b173b"
            fillOpacity=".53"
            fillRule="evenodd"
          />
          <polygon
            points={corners.map((p) => `${p.x * 100},${p.y * 100}`).join(" ")}
            fill="#4879ff"
            fillOpacity=".06"
            stroke="#6fa1ff"
            strokeWidth=".5"
          />
        </svg>
        {corners.map((p, i) => (
          <button
            key={i}
            className={`corner ${drag === i ? "active" : ""}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            aria-label={`调整${["左上", "右上", "右下", "左下"][i]}角`}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDrag(i);
            }}
            onPointerMove={(e) => {
              if (drag !== i || !box.current) return;
              const r = box.current.getBoundingClientRect();
              move(i, {
                x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
                y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
              });
            }}
            onPointerUp={() => setDrag(null)}
            onPointerCancel={() => setDrag(null)}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 0.02 : 0.005;
              const dirs: Record<string, Point> = {
                ArrowLeft: { x: -step, y: 0 },
                ArrowRight: { x: step, y: 0 },
                ArrowUp: { x: 0, y: -step },
                ArrowDown: { x: 0, y: step },
              };
              const d = dirs[e.key];
              if (d) {
                e.preventDefault();
                move(i, {
                  x: Math.max(0, Math.min(1, p.x + d.x)),
                  y: Math.max(0, Math.min(1, p.y + d.y)),
                });
              }
            }}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}
