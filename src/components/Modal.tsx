import { useEffect, useRef, type ReactNode } from "react";
export function Modal({
  title,
  children,
  onClose,
  onConfirm,
  confirmLabel = "确定",
  danger = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="native-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <div className="modal">
        <h2>{title}</h2>
        <div>{children}</div>
        <div className="modal-actions">
          <button className="secondary" onClick={onClose} autoFocus>
            {onConfirm ? "取消" : "知道了"}
          </button>
          {onConfirm && (
            <button
              className={danger ? "danger" : "primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </dialog>
  );
}
