# 茜茜扫描

本地优先的手机文档扫描仪。React + TypeScript + Vite，支持 PWA。

## 运行

需要 Node.js 22.12+。

```sh
npm ci
npm run dev
```

桌面打开 http://localhost:5173 。

```sh
npm run typecheck
npm run check:images
npm run build
npm run preview
```

`npm run preview` 在 http://localhost:4173 提供生产构建，可验证 Service Worker。开发服务器不启用离线缓存，避免旧缓存干扰开发。

## 手机上使用

摄像头 `getUserMedia`、Web Share 与 PWA 需要安全来源：HTTPS 或当前设备自身的 localhost。手机打开电脑的 `http://192.168…:5173` 可以验证相册导入与布局，但不能据此验证摄像头 / PWA。

将 `dist/` 发布到任意 HTTPS 静态站点即可使用完整功能；不需要后端、账户或密钥。普通构建部署到域名根路径；`npm run build -- --mode github` 构建使用 `/scango/` 子路径，Worker、manifest 与离线缓存均已适配。也可使用受手机信任的本地 HTTPS 证书做局域网开发。不要跳过浏览器证书警告。

首次联网完整加载生产站点，等待 Service Worker 缓存完成后，可离线打开。OpenCV 约 11 MB，随应用一同缓存，不运行时访问外部 CDN。iOS 在 Safari 分享菜单中选择“添加到主屏幕”；Android 在 Chrome 菜单中安装应用。

## 已实现

- 优先后置摄像头、拍照、取消、重拍；权限 / 无相机 / 非安全来源提示；相册导入。
- OpenCV 缩图检测：灰度、Gaussian Blur、Canny、形态闭运算、轮廓、最大凸四边形；Otsu 分割补充候选。
- 归一化四角坐标、触摸 / 鼠标拖动、键盘方向键微调；拒绝交叉和过小裁剪框。
- `getPerspectiveTransform` / `warpPerspective`，按照四边长度确定输出宽高。
- 原图（矫正后未经增强）、自动增强、彩色增强、灰度、自适应黑白。
- 多页、删除、重拍、旋转、重新裁剪与滤镜、长按手柄排序、键盘排序及前移 / 后移。
- 标准 / 高清 PDF、A4 近似比例识别、横竖页、文件命名、下载、系统文件分享及下载回退。
- Dexie / IndexedDB 保存文档、原始 Blob、处理结果、缩略图、时间与 PDF；刷新后恢复历史，继续编辑。
- 安全区、横竖屏、桌面 / 平板 / 手机布局与 PWA 图标。

## 处理与内存

原始文件以 Blob 保留。检测使用最长边 1100 px 的副本，编辑预览最长边 1800 px，透视处理最长边 2600 px。角点用 0–1 坐标映射至处理图。OpenCV 在经典 Web Worker 中串行计算，所有 Mat / MatVector 在 finally 中释放。React 状态保存 Blob，不保存持久化 Base64；预览 Object URL 在组件卸载或替换时释放。

标准 PDF 图片最长边 1600 px / JPEG 0.76；高清 2600 px / JPEG 0.90。每页依次编码，避免同时保留全部原图像素。PDF 大小取决于内容和页数，不承诺固定大小。超 80 MB 文件拒绝导入。浏览器仍需解码原始照片，低内存设备上的 48 MP / HEIC 支持受系统限制；格式不支持时请使用 JPEG / PNG。

自动增强使用低分辨率光照背景估计、亮度补偿、色通道白点校正、对比度与轻度锐化。黑白采用 Gaussian adaptive threshold，避免固定阈值。边缘检测是启发式算法：低对比、杂乱背景、无完整边缘的照片可能需手动调角。重裁剪从原始照片开始，会重置此前的旋转。A4 打印纸可选横/竖 A4 校正比例，票据等请选择自由比例。

## 文件结构

- `src/pages`：首页、导出页。
- `src/components`：摄像头、四角裁剪、页面排序、Blob 图片及对话框。
- `src/App.tsx`：扫描流程状态、草稿与文档协调。
- `src/services/imageProcessor.ts`：Worker 任务、超时与像素传输。
- `public/processor.worker.js`：OpenCV 检测、矫正与增强。
- `src/services/pdfService.ts`：逐页压缩、PDF 比例与下载。
- `src/services/storageService.ts`：本地数据库。
- `src/utils`：图像编解码、压缩、旋转与角点验证。
- `src/types/scan.ts`：文档 / 页面 / 滤镜类型。
- `scripts/check-image-pipeline.mjs`：真实 OpenCV 的合成图回归检查。

`public/opencv.js` 从锁定依赖 `@techstark/opencv-js` 复制，确保离线使用。升级该依赖时执行 `npm run sync:opencv` 并重新验证、构建。库许可证见 `THIRD_PARTY_NOTICES.md`。

## 数据与隐私

没有上传接口、分析埋点、远程字体或云 API。文档只存在当前浏览器、当前来源的 IndexedDB。不同设备 / 浏览器不自动同步；清除网站数据或系统回收存储会删除文档。重要文件请及时下载 PDF。删除文档或页面会要求确认，完成后不可恢复。修改页面会使旧 PDF 失效，需重新导出。

## 验证边界

详见 `VERIFICATION.md`。自动化 / 桌面浏览器验证不能代替 iPhone Safari、Android Chrome 真机的摄像头、系统分享和安装测试。最终发布前请使用真实纸张、真实手机完成其中的验收表。

## GitHub Pages

仓库： https://github.com/Bigjiang001/scango

网站： https://bigjiang001.github.io/scango/

向 main 推送后，GitHub Actions 自动执行类型检查、图像算法测试、生产构建并部署。首次访问需要联网下载应用和 OpenCV；后续可离线使用。网站本身为公开静态页面，文档内容不上传 GitHub。

应用名称已统一为“茜茜扫描”。数据库保留原有内部名称，以兼容开发阶段已有本地文档。

## v1.1：可靠裁边与统一纸张

- 自动裁边综合多组边缘/亮度候选、纸张边缘内外对比、文字笔画覆盖、形状与位置评分，不再单纯选最大四边形。
- 拍摄框与视频 `object-fit: contain` 后的实际图片坐标对应，横竖屏均使用同一坐标映射；可切换横/竖取景，检测优先取景框中的纸张。
- 无可靠边缘时保留拍摄框（相册导入保留整张），并提示手动确认。可重新识别、切换候选框、恢复拍摄框或选择整张。
- v1.2 导出默认自由尺寸；可选择 A3、A4、A5、B5（ISO）、Letter、Legal 横/竖向，或自定义宽高（20–2000 mm）。选择固定尺寸时整份文档统一纸型。统一 0 / 5 / 10 mm 边距；逐页预览排版。内容等比居中，不强行拉伸或裁掉文字。
- 已保存文档可直接重新导出为 A4，不必重新扫描。旧 PDF 缓存首次进入新导出页时失效，重新生成后保存新排版设置；原始照片和扫描页不删除。
- 新增 `npm run check:layout`（45 组排版 + 18 组相机框映射），并接入 GitHub 发布检查。
- 新版本下载完成后显示更新按钮。更新前需保存当前页面；较早的旧版没有更新提示时，请关闭所有该网站/PWA窗口再重新打开。

裁剪阶段的 A4 校正根据已知纸型确定透视目标比例；自由比例按四边长度估算。导出的统一 A4 设置只改变页面画布和边距，图片等比放入。

## v1.2：纸张尺寸可选

裁剪与导出默认自由比例；常用纸型提供横/竖方向，导出额外支持自定义毫米宽高。原文档已保存的导出设置继续保留。固定纸型用于整份统一画布，内容等比居中，不拉伸。
