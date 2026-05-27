import type { Chapter } from "../../types";
import { FileText, Plus } from "lucide-react";

interface Props {
  chapters: Chapter[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}

export function ChapterTree({ chapters, activeId, onSelect, onAdd }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-xs font-semibold text-content-muted uppercase tracking-wider">
          章节目录
        </span>
        <button
          onClick={onAdd}
          className="p-1 rounded-md hover:bg-surface-hover text-content-muted hover:text-content-primary transition-colors"
          title="添加章节"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {chapters.length === 0 ? (
          <div className="text-center text-content-muted text-sm py-8">
            暂无章节，点击 + 创建
          </div>
        ) : (
          chapters.map((ch) => (
            <button
              key={ch.id}
              onClick={() => onSelect(ch.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm mb-0.5 transition-colors flex items-center gap-2 ${
                ch.id === activeId
                  ? "bg-brand-600/20 text-brand-600 dark:text-brand-400"
                  : "text-content-secondary hover:bg-surface-hover hover:text-content-primary"
              }`}
            >
              <FileText size={14} className="shrink-0 opacity-50" />
              <span className="truncate">
                <span className="text-content-muted text-xs">第{ch.sort_order}章</span> {ch.title}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
