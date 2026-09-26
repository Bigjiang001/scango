import { useEffect, useRef, useState } from "react";
import {
  ScanLine,
  ShieldCheck,
  X,
  Loader2,
  ArrowLeft,
  Check,
  Plus,
  Upload,
  FileText,
  RefreshCw,
  Maximize,
} from "lucide-react";
import { Home } from "./pages/Home";
import { Export } from "./pages/Export";
import { CameraScanner } from "./components/CameraScanner";
import { DocumentCropper } from "./components/DocumentCropper";
import { PageSorter } from "./components/PageSorter";
import { BlobImage } from "./components/BlobImage";
import { Modal } from "./components/Modal";
import { listDocuments, saveDocument, db } from "./services/storageService";
import {
  detectDocument,
  correctPerspective,
  applyFilter,
} from "./services/imageProcessor";
import { resize, rotateImage } from "./utils/images";
import {
  filters,
  type ScanDocument,
  type ScanPage,
  type Corners,
  type DetectionResult,
  type Filter,
} from "./types/scan";
import type { PageFormat } from "./utils/pdfLayout";
import { newId } from "./utils/id";
type View = "home" | "camera" | "crop" | "enhance" | "editor" | "export";
type Draft = {
  cropFormat?: PageFormat;
  guide?: Corners;
  alternatives?: Corners[];
  candidateIndex?: number;
  original: Blob;
  preview: Blob;
  corners: Corners;
  detected: boolean;
  dark: boolean;
  corrected?: Blob;
  processed?: Blob;
  width: number;
  height: number;
  filter: Filter;
  replaceId?: string;
};
function fresh(): ScanDocument {
  return {
    id: newId(),
    name: `扫描_${new Date().toLocaleDateString("sv-SE")}_${new Date().toTimeString().slice(0, 5).replace(":", "")}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pages: [],
  };
}
export default function App() {
  const [view, setView] = useState<View>("home");
  const [documents, setDocuments] = useState<ScanDocument[]>([]);
  const [doc, setDoc] = useState<ScanDocument | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [help, setHelp] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    text: string;
    run: () => Promise<void>;
  } | null>(null);
  const [replaceId, setReplaceId] = useState<string | undefined>();
  const input = useRef<HTMLInputElement>(null);
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch(() => {
        setStorageError(true);
        setMessage(
          "无法访问本地存储。请关闭隐私浏览模式或释放设备空间，然后重新打开应用。",
        );
      });
  }, []);
  async function task(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage((e as Error).message || "操作失败，请重试。");
    } finally {
      setBusy("");
    }
  }
  async function persist(next: ScanDocument) {
    try {
      await saveDocument(next);
      setDoc(next);
      setDocuments(await listDocuments());
    } catch {
      throw new Error(
        "无法保存到设备，请释放存储空间后重试。当前编辑仍保留在页面中。",
      );
    }
  }
  async function updatePages(pages: ScanPage[]) {
    if (!doc) return;
    const next = { ...doc, pages, pdfInfo: undefined, updatedAt: Date.now() };
    await persist(next);
  }
  function start(source: "camera" | "import", replace?: string) {
    if (view === "home" || !doc) setDoc(fresh());
    setReplaceId(replace);
    setDraft(null);
    if (source === "camera") setView("camera");
    else input.current?.click();
  }
  function leave() {
    setDraft(null);
    setReplaceId(undefined);
    setView(doc?.pages.length ? "editor" : "home");
  }
  async function capture(blob: Blob, guide?: Corners) {
    await task("正在寻找文档边缘…", async () => {
      if (blob.size > 80 * 1024 * 1024)
        throw new Error("图片超过 80 MB，请选择较小的照片。");
      const preview = await resize(blob, 1800, 0.88);
      let result: DetectionResult;
      try {
        result = await detectDocument(preview.blob, guide);
      } catch (e) {
        setMessage(
          "自动检测暂时不可用，请手动调整四角。" + (e as Error).message,
        );
        result = {
          corners: guide || [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
          ],
          alternatives: [],
          confidence: 0,
          detected: false,
          dark: false,
        };
      }
      setDraft({
        guide,
        candidateIndex: 0,
        cropFormat:
          Math.hypot(
            (result.corners[1].x - result.corners[0].x) * preview.width,
            (result.corners[1].y - result.corners[0].y) * preview.height,
          ) >
          Math.hypot(
            (result.corners[3].x - result.corners[0].x) * preview.width,
            (result.corners[3].y - result.corners[0].y) * preview.height,
          )
            ? "a4-landscape"
            : "a4",
        original: blob,
        preview: preview.blob,
        ...result,
        width: preview.width,
        height: preview.height,
        filter: "auto",
        replaceId,
      });
      setView("crop");
    });
  }
  async function redetect() {
    if (!draft) return;
    await task("正在重新识别整张纸…", async () => {
      const result = await detectDocument(draft.preview, draft.guide);
      setDraft({ ...draft, ...result, candidateIndex: 0 });
    });
  }
  async function warp() {
    if (!draft) return;
    await task("正在拉正文档…", async () => {
      const corrected = await correctPerspective(
        draft.original,
        draft.corners,
        draft.cropFormat,
      );
      const enhanced = await applyFilter(corrected.blob, draft.filter);
      setDraft({
        ...draft,
        corrected: corrected.blob,
        processed: enhanced.blob,
        width: enhanced.width,
        height: enhanced.height,
      });
      setView("enhance");
    });
  }
  async function filter(mode: Filter) {
    if (!draft?.corrected) return;
    await task("正在优化图像…", async () => {
      const p = await applyFilter(draft.corrected!, mode);
      setDraft({ ...draft, filter: mode, processed: p.blob });
    });
  }
  async function addPage() {
    if (!draft?.processed || !doc) return;
    await task("正在保存扫描页…", async () => {
      const thumbnail = await resize(draft.processed!, 360, 0.78);
      const page: ScanPage = {
        id: draft.replaceId || newId(),
        originalImage: draft.original,
        processedImage: draft.processed!,
        thumbnail: thumbnail.blob,
        corners: draft.corners,
        rotation: 0,
        cropFormat: draft.cropFormat,
        filter: draft.filter,
        width: draft.width,
        height: draft.height,
      };
      await updatePages(
        draft.replaceId
          ? doc.pages.map((p) => (p.id === draft.replaceId ? page : p))
          : [...doc.pages, page],
      );
      setDraft(null);
      setReplaceId(undefined);
      setView("editor");
    });
  }
  async function cropPage(page: ScanPage) {
    await task("正在打开原图…", async () => {
      const preview = await resize(page.originalImage, 1800);
      setDraft({
        cropFormat: page.cropFormat || "original",
        original: page.originalImage,
        preview: preview.blob,
        corners: page.corners,
        detected: true,
        dark: false,
        width: preview.width,
        height: preview.height,
        filter: page.filter,
        replaceId: page.id,
      });
      setReplaceId(page.id);
      setView("crop");
    });
  }
  async function rotate(page: ScanPage) {
    await task("正在旋转…", async () => {
      const result = await rotateImage(page.processedImage);
      const thumb = await resize(result.blob, 360, 0.78);
      await updatePages(
        doc!.pages.map((p) =>
          p.id === page.id
            ? {
                ...p,
                processedImage: result.blob,
                thumbnail: thumb.blob,
                width: result.width,
                height: result.height,
                rotation: (p.rotation + 90) % 360,
              }
            : p,
        ),
      );
    });
  }
  async function rename(name: string) {
    if (!doc) return;
    const cleaned = name.trim() || doc.name;
    if (cleaned === doc.name) return;
    await task("正在保存名称…", () =>
      persist({
        ...doc,
        name: cleaned,
        updatedAt: Date.now(),
        pdfInfo: undefined,
      }),
    );
  }
  return (
    <div className="app">
      <header inert={!!busy}>
        <button
          className="brand"
          onClick={() => {
            if (view === "crop" || view === "enhance") {
              setConfirm({
                title: "退出当前扫描？",
                text: "已保存的页面会保留，当前尚未确认的照片将被放弃。",
                run: async () => {
                  setDraft(null);
                  setView("home");
                },
              });
            } else setView("home");
          }}
          aria-label="茜茜扫描 首页"
        >
          <span>
            <ScanLine size={24} />
          </span>
          茜茜扫描<span className="brand-dot">.</span>
        </button>
        <button className="header-right" onClick={() => setHelp(true)}>
          <ShieldCheck size={16} /> 设备本地处理
        </button>
      </header>
      <main inert={!!busy}>
        {storageError && (
          <div className="error">
            本地存储不可用。请关闭隐私浏览或释放空间后刷新，避免扫描后无法保存。
          </div>
        )}
        {view === "home" && (
          <Home
            documents={documents}
            onScan={() => start("camera")}
            onImport={() => start("import")}
            onOpen={(d) => {
              setDoc(d);
              setView("editor");
            }}
            onDelete={(d) =>
              setConfirm({
                title: "删除这份文档？",
                text: `“${d.name}”的 ${d.pages.length} 页扫描及 PDF 将从此设备永久删除。`,
                run: async () => {
                  await db.documents.delete(d.id);
                  setDocuments(await listDocuments());
                },
              })
            }
            onHelp={() => setHelp(true)}
          />
        )}
        {view === "crop" && draft && (
          <div className="workspace">
            <div className="view-header">
              <button
                className="icon-button"
                onClick={leave}
                aria-label="取消裁剪"
              >
                <ArrowLeft />
              </button>
              <div>
                <h1>贴合纸张的每一个角</h1>
                <p>拖动四角，调整文档范围</p>
              </div>
              <span className="step-label">01 裁剪 → 02 增强 → 03 保存</span>
            </div>
            {!draft.detected && (
              <div className="error">
                无法可靠确认纸张边缘，已保留取景范围。请检查四角，避免裁掉文字。
              </div>
            )}
            {draft.dark && (
              <div className="error">当前环境较暗，建议增加光线。</div>
            )}
            <DocumentCropper
              blob={draft.preview}
              corners={draft.corners}
              onChange={(corners) => setDraft({ ...draft, corners })}
            />
            <div className="crop-format">
              <label className="field" htmlFor="crop-format">
                纸张校正比例
              </label>
              <select
                id="crop-format"
                className="input"
                value={draft.cropFormat || "original"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    cropFormat: e.target.value as PageFormat,
                  })
                }
              >
                <option value="a4">A4 竖向文件</option>
                <option value="a4-landscape">A4 横向文件</option>
                <option value="original">自由比例（票据 / 卡片等）</option>
              </select>
              <p className="hint">
                普通打印纸按 A4 比例拉正；其他纸张请选择自由比例。
              </p>
            </div>
            <div className="detection-tools">
              <button className="secondary" onClick={redetect}>
                <RefreshCw size={16} /> 重新识别
              </button>
              {(draft.alternatives?.length || 0) > 1 && (
                <button
                  className="secondary"
                  onClick={() => {
                    const index =
                      ((draft.candidateIndex || 0) + 1) %
                      draft.alternatives!.length;
                    setDraft({
                      ...draft,
                      corners: draft.alternatives![index],
                      candidateIndex: index,
                      detected: true,
                    });
                  }}
                >
                  换一个识别框
                </button>
              )}
              {draft.guide && (
                <button
                  className="secondary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      corners: draft.guide!,
                      detected: false,
                    })
                  }
                >
                  恢复拍摄框
                </button>
              )}
            </div>
            <div className="crop-help">
              <p className="hint">确认后将自动校正透视，还原正面文档。</p>
              <button
                className="text-button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    corners: [
                      { x: 0, y: 0 },
                      { x: 1, y: 0 },
                      { x: 1, y: 1 },
                      { x: 0, y: 1 },
                    ],
                  })
                }
              >
                <Maximize size={17} /> 选择整张
              </button>
            </div>
            <div className="action-bar">
              <button className="secondary" onClick={() => setView("camera")}>
                <RefreshCw size={17} /> 重拍
              </button>
              <button className="primary" onClick={warp}>
                <Check size={18} /> 确认裁剪
              </button>
            </div>
          </div>
        )}
        {view === "enhance" && draft?.processed && (
          <div className="workspace">
            <div className="view-header">
              <button
                className="icon-button"
                onClick={() => setView("crop")}
                aria-label="返回裁剪"
              >
                <ArrowLeft />
              </button>
              <div>
                <h1>让每一个字更清晰</h1>
                <p>选择适合这份文件的扫描效果</p>
              </div>
              <span className="step-label">01 裁剪 → 02 增强 → 03 保存</span>
            </div>
            <div className="enhance-preview">
              <BlobImage
                blob={draft.processed}
                alt={`${filters.find((f) => f.id === draft.filter)?.label}预览`}
              />
            </div>
            <div className="filter-list" aria-label="扫描滤镜">
              {filters.map((f) => (
                <button
                  key={f.id}
                  className={`filter-button ${draft.filter === f.id ? "selected" : ""}`}
                  aria-pressed={draft.filter === f.id}
                  onClick={() => filter(f.id)}
                >
                  {f.label}
                  <span>{f.note}</span>
                </button>
              ))}
            </div>
            <div className="action-bar">
              <button className="secondary" onClick={() => setView("crop")}>
                调整裁剪
              </button>
              <button className="primary" onClick={addPage}>
                <Check size={18} /> 保存这一页
              </button>
            </div>
          </div>
        )}
        {view === "editor" && doc && (
          <div className="workspace">
            <div className="view-header">
              <button
                className="icon-button"
                onClick={() => setView("home")}
                aria-label="返回首页"
              >
                <ArrowLeft />
              </button>
              <div>
                <input
                  className="editor-name"
                  key={doc.id + doc.name}
                  defaultValue={doc.name}
                  maxLength={100}
                  aria-label="文档名称"
                  onBlur={(e) => rename(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                />
                <p>{doc.pages.length} 页 · 已保存到此设备</p>
              </div>
            </div>
            <div className="editor-meta">
              <p className="hint">
                长按右上角拖动手柄调整顺序，也可使用前移 / 后移。
              </p>
              <button className="text-button" onClick={() => start("import")}>
                <Upload size={16} /> 从相册添加
              </button>
            </div>
            {doc.pages.length ? (
              <PageSorter
                pages={doc.pages}
                onReorder={(pages) =>
                  task("正在保存顺序…", () => updatePages(pages))
                }
                onRotate={rotate}
                onCrop={cropPage}
                onRetake={(p) => start("camera", p.id)}
                onDelete={(p) =>
                  setConfirm({
                    title: "删除这一页？",
                    text: "这张扫描页及其原始照片将从文档中移除。",
                    run: () =>
                      updatePages(doc.pages.filter((page) => page.id !== p.id)),
                  })
                }
              />
            ) : (
              <div className="empty-editor">
                文档还没有页面，添加一页开始扫描。
              </div>
            )}
            <div className="action-bar">
              <button className="secondary" onClick={() => start("camera")}>
                <Plus size={18} /> 添加页面
              </button>
              <button
                className="primary"
                disabled={!doc.pages.length}
                onClick={() => setView("export")}
              >
                <FileText size={18} /> 生成 PDF
              </button>
            </div>
          </div>
        )}
        {view === "export" && doc && (
          <Export
            document={doc}
            onBack={() => setView("editor")}
            onSaved={persist}
            onError={setMessage}
          />
        )}
      </main>
      {view === "camera" && (
        <CameraScanner
          onCapture={capture}
          onCancel={leave}
          onImport={() => input.current?.click()}
        />
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void capture(f);
        }}
      />
      {busy && (
        <div className="busy-overlay" role="status" aria-live="polite">
          <div className="busy-box">
            <Loader2 className="spin" size={23} />
            {busy}
          </div>
        </div>
      )}
      {message && (
        <div className="notice" role="alert">
          {message}
          <button
            className="icon-button"
            onClick={() => setMessage("")}
            aria-label="关闭提示"
          >
            <X size={18} />
          </button>
        </div>
      )}
      {help && (
        <Modal title="你的随身文档工作空间" onClose={() => setHelp(false)}>
          <p>
            所有文档处理默认在您的设备本地完成，不上传服务器。原始照片、扫描结果和
            PDF 存储在当前浏览器中。
          </p>
          <p>
            iPhone / iPad：使用 Safari
            的“分享”菜单，选择“添加到主屏幕”。Android：在 Chrome
            菜单中选择“安装应用”或“添加到主屏幕”。
          </p>
          <p>
            首次完整加载后可离线使用。清除浏览器网站数据会删除本地文档，请及时导出重要
            PDF。相机需通过 HTTPS 或本机 localhost 访问。
          </p>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm.title}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            const action = confirm.run;
            setConfirm(null);
            void task("正在处理…", action);
          }}
          confirmLabel="确认"
          danger
        >
          <p>{confirm.text}</p>
        </Modal>
      )}
    </div>
  );
}
