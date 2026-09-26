import {
  Camera,
  Upload,
  ScanLine,
  ArrowUpRight,
  ShieldCheck,
  FileText,
  Trash2,
  Plus,
  Smartphone,
  FolderOpen,
} from "lucide-react";
import type { ScanDocument } from "../types/scan";
import { BlobImage } from "../components/BlobImage";
export function Home({
  documents,
  onScan,
  onImport,
  onOpen,
  onDelete,
  onHelp,
}: {
  documents: ScanDocument[];
  onScan: () => void;
  onImport: () => void;
  onOpen: (d: ScanDocument) => void;
  onDelete: (d: ScanDocument) => void;
  onHelp: () => void;
}) {
  return (
    <>
      <div className="home-heading">
        <div>
          <div className="eyebrow">YOUR POCKET SCANNER</div>
          <h1>
            让纸张，轻一点<span>。</span>
          </h1>
          <p>从一张纸，到一份清晰的 PDF。</p>
        </div>
        <span className="local-badge">
          <span /> 本地工作空间
        </span>
      </div>
      <div className="scan-grid">
        <button className="scan-card" onClick={onScan}>
          <div className="scan-card-top">
            <span className="large-icon">
              <ScanLine size={32} />
            </span>
            <ArrowUpRight size={25} />
          </div>
          <div>
            <h2>开始扫描</h2>
            <p>拍下文件，剩下的交给 茜茜扫描</p>
          </div>
          <span className="scan-card-bottom">
            <span>
              <Camera size={18} /> 打开摄像头
            </span>
            <span>01 — SCAN</span>
          </span>
        </button>
        <button className="import-card" onClick={onImport}>
          <span className="import-icon">
            <Upload size={28} />
          </span>
          <h2>从相册导入</h2>
          <p>已有照片？从这里开始。</p>
          <span className="subtle-link">
            选择图片 <ArrowUpRight size={16} />
          </span>
        </button>
      </div>
      <div className="privacy-strip">
        <ShieldCheck size={21} />
        <div>
          <strong>你的文档，只属于你</strong>
          <p>所有文档处理默认在您的设备本地完成，不上传服务器。</p>
        </div>
        <span className="privacy-tag">LOCAL & PRIVATE</span>
      </div>
      <section className="recent">
        <div className="section-title">
          <div>
            <h2>
              最近扫描{" "}
              <span>{documents.length.toString().padStart(2, "0")}</span>
            </h2>
            <p>每一份重要文件，都在这里。</p>
          </div>
          {documents.length > 0 && (
            <button className="text-button" onClick={onScan}>
              <Plus size={18} /> 新建扫描
            </button>
          )}
        </div>
        {documents.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              <FolderOpen size={30} />
            </span>
            <h3>给第一份文件一个新家</h3>
            <p>扫描合同、笔记或灵感，随时整理，随身携带。</p>
            <button className="text-button" onClick={onScan}>
              开始你的第一次扫描 <ArrowUpRight size={17} />
            </button>
          </div>
        ) : (
          <div className="document-grid">
            {documents.map((d) => (
              <article className="document-card" key={d.id}>
                <button className="document-open" onClick={() => onOpen(d)}>
                  <div className="document-cover">
                    {d.pages[0] ? (
                      <BlobImage blob={d.pages[0].thumbnail} alt={d.name} />
                    ) : (
                      <FileText />
                    )}
                    <span className="page-count">{d.pages.length} 页</span>
                  </div>
                  <h3>{d.name}</h3>
                  <p>
                    {new Date(d.updatedAt).toLocaleDateString("zh-CN")} ·{" "}
                    {d.pdfInfo ? "已导出 PDF" : "扫描文档"}
                  </p>
                </button>
                <button
                  className="delete-document icon-button"
                  aria-label={`删除 ${d.name}`}
                  onClick={() => onDelete(d)}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
      <footer>
        <span>
          茜茜扫描 <span className="footer-separator">/</span>{" "}
          把清晰，留在身边。 · v1.2
        </span>
        <button className="text-button" onClick={onHelp}>
          <Smartphone size={16} /> 添加到主屏幕
        </button>
      </footer>
    </>
  );
}
