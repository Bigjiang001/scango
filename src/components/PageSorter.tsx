import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  RotateCw,
  Crop,
  Trash2,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { ScanPage } from "../types/scan";
import { BlobImage } from "./BlobImage";
interface Props {
  pages: ScanPage[];
  onReorder: (p: ScanPage[]) => void;
  onRotate: (p: ScanPage) => void;
  onCrop: (p: ScanPage) => void;
  onRetake: (p: ScanPage) => void;
  onDelete: (p: ScanPage) => void;
}
function Page({
  page,
  index,
  total,
  onMove,
  ...props
}: {
  page: ScanPage;
  index: number;
  total: number;
  onMove: (delta: number) => void;
} & Omit<Props, "pages" | "onReorder">) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });
  return (
    <article
      ref={setNodeRef}
      className={`page-card ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="page-card-head">
        <span>第 {index + 1} 页</span>
        <button
          className="drag-handle icon-button"
          aria-label={`拖动第 ${index + 1} 页排序`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={20} />
        </button>
      </div>
      <div className="page-preview">
        <BlobImage blob={page.thumbnail} alt={`第 ${index + 1} 页扫描结果`} />
      </div>
      <div className="page-tools">
        <button
          className="icon-button"
          onClick={() => props.onRotate(page)}
          aria-label={`旋转第 ${index + 1} 页`}
          title="旋转90°"
        >
          <RotateCw size={18} />
        </button>
        <button
          className="icon-button"
          onClick={() => props.onCrop(page)}
          aria-label={`裁剪第 ${index + 1} 页`}
          title="重新裁剪与滤镜"
        >
          <Crop size={18} />
        </button>
        <button
          className="icon-button"
          onClick={() => props.onRetake(page)}
          aria-label={`重拍第 ${index + 1} 页`}
          title="重新拍摄"
        >
          <Camera size={18} />
        </button>
        <button
          className="icon-button"
          onClick={() => props.onDelete(page)}
          aria-label={`删除第 ${index + 1} 页`}
          title="删除"
        >
          <Trash2 size={18} />
        </button>
      </div>
      <div className="page-move">
        <button
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`前移第 ${index + 1} 页`}
        >
          <ChevronLeft size={15} />
          前移
        </button>
        <span>
          {page.width} × {page.height}
        </span>
        <button
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={`后移第 ${index + 1} 页`}
        >
          后移
          <ChevronRight size={15} />
        </button>
      </div>
    </article>
  );
}
export function PageSorter(props: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 7 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function drag(e: DragEndEvent) {
    if (e.over && e.active.id !== e.over.id) {
      const a = props.pages.findIndex((p) => p.id === e.active.id),
        b = props.pages.findIndex((p) => p.id === e.over!.id);
      props.onReorder(arrayMove(props.pages, a, b));
    }
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={drag}
    >
      <SortableContext
        items={props.pages.map((p) => p.id)}
        strategy={rectSortingStrategy}
      >
        <div className="pages-grid">
          {props.pages.map((p, i) => (
            <Page
              key={p.id}
              page={p}
              index={i}
              total={props.pages.length}
              onMove={(delta) =>
                props.onReorder(arrayMove(props.pages, i, i + delta))
              }
              {...props}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
