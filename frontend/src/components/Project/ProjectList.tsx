import { useState, useEffect } from "react";
import type { Project } from "../../types";
import { BookOpen, Plus, Clock, Trash2 } from "lucide-react";
import { ImportNovel } from "./ImportNovel";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { CardSkeleton } from "../ui/LoadingSkeleton";
import { ConfirmDialog } from "../ui/ConfirmDialog";

interface Props {
  onSelect: (project: Project) => void;
}

export function ProjectList({ onSelect }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = () => {
    fetch("/api/v1/projects/")
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const handleImportComplete = (projectId: string) => {
    setShowImport(false);
    fetchProjects();
    setTimeout(() => {
      setProjects((currentProjects) => {
        const project = currentProjects.find((p) => p.id === projectId);
        if (project) {
          onSelect(project);
        }
        return currentProjects;
      });
    }, 100);
  };

  const handleDeleteProject = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/projects/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      }
    } finally {
      setDeleteTarget(null);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-surface-base overflow-y-auto">
        <div className="max-w-4xl mx-auto p-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
              小说工坊
            </h1>
            <p className="text-content-muted">AI 驱动的小说创作工具 · 加料 · 续写 · 改写</p>
          </div>
          <div className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-surface-base text-content-primary overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
            小说工坊
          </h1>
          <p className="text-content-muted">AI 驱动的小说创作工具 · 加料 · 续写 · 改写</p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-content-primary">我的小说</h2>
          <Button size="sm" onClick={() => setShowImport(true)}>
            <Plus size={16} />
            导入小说
          </Button>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={48} />}
            title="还没有小说项目"
            description="点击上方按钮导入或创建小说项目"
          />
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="text-left p-5 bg-surface-elevated border border-border hover:border-brand-600/30 rounded-xl transition-all hover:bg-surface-hover group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-content-primary mb-1">{p.title}</h3>
                    {p.description && (
                      <p className="text-sm text-content-secondary mb-2 line-clamp-2">{p.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-content-muted">
                      {p.style && <Badge variant="brand">{p.style}</Badge>}
                      {p.author && <span>{p.author}</span>}
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(p.update_time).toLocaleDateString("zh-CN")}
                      </span>
                    </div>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
                    className="p-2 rounded-lg text-content-muted hover:text-error hover:bg-error-bg/50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="删除项目"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setDeleteTarget(p); }}}
                  >
                    <Trash2 size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showImport && (
        <ImportNovel
          onComplete={handleImportComplete}
          onCancel={() => setShowImport(false)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProject}
        title="删除项目"
        message={`确定要删除"${deleteTarget?.title}"吗？此操作不可恢复，所有章节和人物数据都将被删除。`}
        loading={deleting}
      />
    </div>
  );
}
