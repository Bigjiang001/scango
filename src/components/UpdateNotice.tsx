import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Modal } from "./Modal";
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  const [confirm, setConfirm] = useState(false);
  if (!needRefresh) return null;
  return (
    <>
      <div className="update-notice" role="status">
        <span>茜茜扫描有新版本</span>
        <button onClick={() => setConfirm(true)}>更新</button>
      </div>
      {confirm && (
        <Modal
          title="更新茜茜扫描"
          onClose={() => setConfirm(false)}
          onConfirm={() => void updateServiceWorker(true)}
          confirmLabel="重新打开新版"
        >
          <p>
            已保存的文档会保留。请先保存当前扫描页，再更新；未保存的照片或调整会被放弃。
          </p>
        </Modal>
      )}
    </>
  );
}
