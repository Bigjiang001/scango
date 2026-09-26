import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Share2,
  FileCheck2,
  FileText,
  Check,
  Loader2,
} from "lucide-react";
import type { ScanDocument } from "../types/scan";
import { generatePdf, downloadPdf } from "../services/pdfService";
import { fileName } from "../utils/images";
export function Export({
  document: doc,
  onBack,
  onSaved,
  onError,
}: {
  document: ScanDocument;
  onBack: () => void;
  onSaved: (d: ScanDocument) => Promise<void>;
  onError: (s: string) => void;
}) {
  const [name, setName] = useState(doc.name);
  const [quality, setQuality] = useState<"standard" | "high">(
    doc.pdfInfo?.quality || "standard",
  );
  const [pdf, setPdf] = useState<Blob | undefined>(doc.pdfInfo?.blob);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  async function generate() {
    setBusy(true);
    setProgress(0);
    try {
      const updated = { ...doc, name: fileName(name).replace(/\.pdf$/i, "") };
      const blob = await generatePdf(updated, quality, setProgress);
      await onSaved({
        ...updated,
        updatedAt: Date.now(),
        pdfInfo: { blob, quality, generatedAt: Date.now() },
      });
      setPdf(blob);
    } catch (e) {
      onError("PDF 生成或保存失败：" + (e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    if (!pdf) return;
    const f = new File([pdf], fileName(name), { type: "application/pdf" });
    try {
      if (navigator.canShare?.({ files: [f] }))
        await navigator.share({ files: [f], title: name });
      else {
        downloadPdf(pdf, fileName(name));
        onError("此浏览器不支持文件分享，已改为下载 PDF。");
      }
    } catch (e) {
      if ((e as DOMException).name !== "AbortError")
        onError("分享未完成，请尝试下载 PDF。");
    }
  }
  return (
    <div className="workspace">
      <div className="view-header">
        <button
          className="icon-button"
          onClick={onBack}
          disabled={busy}
          aria-label="返回编辑"
        >
          <ArrowLeft />
        </button>
        <div>
          <h1>{pdf ? "文件已准备好" : "导出 PDF"}</h1>
          <p>{doc.pages.length} 页文档 · 在此设备上生成</p>
        </div>
      </div>
      <div className="export-layout">
        <div className="export-summary">
          <div className={`pdf-symbol ${pdf ? "complete" : ""}`}>
            {pdf ? <FileCheck2 size={55} /> : <FileText size={55} />}
          </div>
          <h2>{pdf ? "清晰归档，随时分享" : "把每一页，整理成一份"}</h2>
          <p>
            {pdf
              ? `${(pdf.size / 1024 / 1024).toFixed(2)} MB · ${doc.pages.length} 页 · PDF`
              : "保持纸张比例，让阅读和打印都更自然。"}
          </p>
          <span className="export-label">
            {pdf ? (
              <>
                <Check size={14} /> 已保存到本地文档
              </>
            ) : (
              "PDF DOCUMENT"
            )}
          </span>
        </div>
        <div className="panel export-options">
          <label className="field" htmlFor="filename">
            文件名称
          </label>
          <div className="filename-field">
            <input
              id="filename"
              className="input"
              value={name}
              maxLength={100}
              disabled={busy}
              onChange={(e) => {
                setName(e.target.value);
                setPdf(undefined);
              }}
            />
            <span>.pdf</span>
          </div>
          <fieldset disabled={busy}>
            <legend>导出清晰度</legend>
            <label
              className={`quality-choice ${quality === "standard" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="quality"
                checked={quality === "standard"}
                onChange={() => {
                  setQuality("standard");
                  setPdf(undefined);
                }}
              />
              <div>
                <strong>标准</strong>
                <p>日常阅读、微信发送 · 文件更小</p>
              </div>
              <span>推荐</span>
            </label>
            <label
              className={`quality-choice ${quality === "high" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="quality"
                checked={quality === "high"}
                onChange={() => {
                  setQuality("high");
                  setPdf(undefined);
                }}
              />
              <div>
                <strong>高清</strong>
                <p>合同归档、打印 · 保留更多细节</p>
              </div>
            </label>
          </fieldset>
          <p className="hint">
            接近 A4 的文档自动适配 A4
            页面，其他文档按实际比例导出。图片不会拉伸。
          </p>
        </div>
      </div>
      <div className="action-bar">
        {pdf ? (
          <>
            <button className="secondary" onClick={share}>
              <Share2 size={18} /> 分享 PDF
            </button>
            <button
              className="primary"
              onClick={() => downloadPdf(pdf, fileName(name))}
            >
              <Download size={18} /> 下载 PDF
            </button>
          </>
        ) : (
          <button
            className="primary"
            disabled={busy || !doc.pages.length}
            onClick={generate}
          >
            {busy ? (
              <>
                <Loader2 className="spin" size={18} /> 正在生成 {progress}%
              </>
            ) : (
              <>
                <FileText size={18} /> 生成 PDF
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
