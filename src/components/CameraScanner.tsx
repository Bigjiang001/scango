import { useEffect, useRef, useState } from "react";
import { Camera, X, Upload, RefreshCw } from "lucide-react";
import { canvasBlob } from "../utils/images";
export function CameraScanner({
  onCapture,
  onCancel,
  onImport,
}: {
  onCapture: (blob: Blob) => Promise<void>;
  onCancel: () => void;
  onImport: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [shooting, setShooting] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let active: MediaStream | null = null;
    setError("");
    setReady(false);
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "请通过 HTTPS 打开网页以使用摄像头。也可以从相册导入照片。",
          );
        active = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
        });
        if (cancelled) {
          active.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = active;
        if (video.current) {
          video.current.srcObject = active;
          await video.current.play();
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "摄像头权限未开启。请在浏览器的网站设置中允许摄像头，然后重试；也可从相册导入。"
            : name === "NotFoundError"
              ? "未找到摄像头，请连接摄像头或从相册导入。"
              : name === "NotReadableError"
                ? "摄像头正在被其他应用使用，请关闭其他应用后重试。"
                : (e as Error).message || "无法启动摄像头，请重试。",
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      active?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, [retry]);
  async function capture() {
    if (!video.current || !ready || shooting) return;
    setShooting(true);
    try {
      const v = video.current,
        c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      const blob = await canvasBlob(c, 0.95);
      await onCapture(blob);
      setShooting(false);
    } catch {
      setError("拍摄失败，请重试。");
      setShooting(false);
    }
  }
  return (
    <div className="camera-screen">
      <div className="camera-top">
        <button
          className="icon-button"
          onClick={onCancel}
          aria-label="取消拍摄"
        >
          <X />
        </button>
        <span>扫描文件</span>
        <span className="camera-local">本地处理</span>
      </div>
      <div className="camera-view">
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          onLoadedData={() => setReady(true)}
        />
        {!error && (
          <>
            <div className="camera-guide">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="camera-tip">
              {ready ? "将纸张放入取景框 · 保持平稳" : "正在启动摄像头…"}
            </div>
          </>
        )}
        {error && (
          <div className="camera-error">
            <Camera size={40} />
            <h2>暂时无法使用摄像头</h2>
            <p>{error}</p>
            <button
              className="secondary"
              onClick={() => setRetry((r) => r + 1)}
            >
              <RefreshCw size={18} /> 重试
            </button>
          </div>
        )}
      </div>
      <div className="camera-controls">
        <button onClick={onImport}>
          <Upload size={24} />
          <span>相册</span>
        </button>
        <button
          className="shutter"
          onClick={capture}
          disabled={!ready || shooting}
          aria-label="拍摄"
        >
          <span />
        </button>
        <button onClick={onCancel}>
          <X size={24} />
          <span>取消</span>
        </button>
      </div>
    </div>
  );
}
