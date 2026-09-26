import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Share2,
  FileText,
  Check,
  Loader2,
} from "lucide-react";
import { BlobImage } from "../components/BlobImage";
import {
  defaultExportOptions,
  paperSizes,
  type PageFormat,
  pageLayout,
  type ExportOptions,
} from "../utils/pdfLayout";
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
  const [options, setOptions] = useState<ExportOptions>(
    doc.exportOptions || defaultExportOptions,
  );
  const [previewIndex, setPreviewIndex] = useState(0);
  const [pdf, setPdf] = useState<Blob | undefined>(
    doc.pdfInfo?.layoutVersion === 2 ? doc.pdfInfo.blob : undefined,
  );
  const previewPage = doc.pages[Math.min(previewIndex, doc.pages.length - 1)];
  let layout: ReturnType<typeof pageLayout> | undefined;
  let sizeError = "";
  try {
    if (previewPage)
      layout = pageLayout(previewPage.width, previewPage.height, options);
  } catch (e) {
    sizeError = (e as Error).message;
  }
  function changeOptions(next: ExportOptions) {
    setOptions(next);
    setPdf(undefined);
  }

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  async function generate() {
    if (sizeError) return;
    setBusy(true);
    setProgress(0);
    try {
      const updated = {
        ...doc,
        exportOptions: options,
        name: fileName(name).replace(/\.pdf$/i, ""),
      };
      const blob = await generatePdf(updated, quality, setProgress);
      await onSaved({
        ...updated,
        updatedAt: Date.now(),
        pdfInfo: { blob, quality, generatedAt: Date.now(), layoutVersion: 2 },
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
          {previewPage && layout && (
            <div
              className="paper-preview"
              style={{ aspectRatio: `${layout.size[0]} / ${layout.size[1]}` }}
            >
              <BlobImage
                blob={previewPage.thumbnail}
                alt={`第 ${previewIndex + 1} 页排版预览`}
                style={{
                  position: "absolute",
                  left: `${(layout.x / layout.size[0]) * 100}%`,
                  top: `${(layout.y / layout.size[1]) * 100}%`,
                  width: `${(layout.width / layout.size[0]) * 100}%`,
                  height: `${(layout.height / layout.size[1]) * 100}%`,
                }}
              />
            </div>
          )}
          {doc.pages.length > 1 && (
            <div className="preview-pager">
              <button
                className="secondary"
                disabled={previewIndex === 0}
                onClick={() => setPreviewIndex((i) => i - 1)}
              >
                上一页
              </button>
              <span>
                {previewIndex + 1} / {doc.pages.length}
              </span>
              <button
                className="secondary"
                disabled={previewIndex === doc.pages.length - 1}
                onClick={() => setPreviewIndex((i) => i + 1)}
              >
                下一页
              </button>
            </div>
          )}
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
            <legend>整份文档的纸张尺寸</legend>
            <label className="field" htmlFor="paper-format">
              纸张尺寸
            </label>
            <select
              id="paper-format"
              className="input"
              value={options.pageFormat}
              onChange={(e) =>
                changeOptions({
                  ...options,
                  pageFormat: e.target.value as PageFormat,
                })
              }
            >
              <option value="original">自由尺寸（按各页裁剪比例）</option>
              {paperSizes.map((p) => (
                <optgroup
                  key={p.id}
                  label={`${p.label} · ${p.width} × ${p.height} mm`}
                >
                  <option value={p.id}>
                    {p.label} 竖向 · {p.width} × {p.height} mm
                  </option>
                  <option value={`${p.id}-landscape`}>
                    {p.label} 横向 · {p.height} × {p.width} mm
                  </option>
                </optgroup>
              ))}
              <option value="custom">自定义尺寸（输入宽高）</option>
            </select>
            {options.pageFormat === "custom" && (
              <div className="custom-paper-fields">
                <label>
                  宽度（mm）
                  <input
                    className="input"
                    type="number"
                    min="20"
                    max="2000"
                    step="0.1"
                    inputMode="decimal"
                    value={options.customWidthMm ?? 210}
                    onChange={(e) =>
                      changeOptions({
                        ...options,
                        customWidthMm: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  高度（mm）
                  <input
                    className="input"
                    type="number"
                    min="20"
                    max="2000"
                    step="0.1"
                    inputMode="decimal"
                    value={options.customHeightMm ?? 297}
                    onChange={(e) =>
                      changeOptions({
                        ...options,
                        customHeightMm: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
            {sizeError && (
              <p className="error" role="alert">
                {sizeError}
              </p>
            )}
            <p className="hint paper-option-hint">
              选择固定纸张或自定义宽高时，整份文档使用相同页面尺寸；自由尺寸保留每页的裁剪比例。
            </p>
            <label className="field" htmlFor="page-margin">
              统一页边距
            </label>
            <select
              id="page-margin"
              className="input"
              value={options.marginMm}
              onChange={(e) =>
                changeOptions({
                  ...options,
                  marginMm: Number(e.target.value) as 0 | 5 | 10,
                })
              }
            >
              <option value="0">无边距</option>
              <option value="5">5 mm（推荐）</option>
              <option value="10">10 mm（装订留白）</option>
            </select>
          </fieldset>
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
            {options.pageFormat === "original"
              ? "按各页裁剪后的宽高比导出，页面尺寸可能不同。"
              : "所有页面使用所选的纸张尺寸与方向。图片等比居中，空白补白，不拉伸、不裁掉文字。"}
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
            disabled={busy || !doc.pages.length || !!sizeError}
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
