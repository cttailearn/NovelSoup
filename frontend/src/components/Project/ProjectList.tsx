import { useState, useEffect } from "react";
import type { Project } from "../../types";
import { BookOpen, Plus, Clock } from "lucide-react";
import { ImportNovel } from "./ImportNovel";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { CardSkeleton } from "../ui/LoadingSkeleton";

interface Props {
  onSelect: (project: Project) => void;
}

export function ProjectList({ onSelect }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [style, setStyle] = useState("");

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

  const handleCreate = async () => {
    if (!title.trim()) return;
    const res = await fetch("/api/v1/projects/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), description: description.trim(), style: style.trim() }),
    });
    const project = await res.json();
    setProjects((prev) => [project, ...prev]);
    setShowCreate(false);
    setTitle("");
    setDescription("");
    setStyle("");
    onSelect(project);
  };

  const handleImportComplete = (projectId: string) => {
    setShowImport(false);
    fetchProjects();
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      onSelect(project);
    }
  };

  const styles = ["网文风", "严肃文学", "轻小说", "武侠", "科幻", "悬疑"];

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
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowImport(true)}>
              <Plus size={16} />
              导入小说
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
              <Plus size={16} />
              新建空白项目
            </Button>
          </div>
        </div>

        {showCreate && (
          <div className="mb-6 p-6 bg-surface-elevated border border-border rounded-xl">
            <h3 className="text-sm font-semibold text-content-primary mb-4">创建新小说项目</h3>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="小说名称"
              className="mb-3"
            />
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简介（可选）"
              className="mb-3"
            />
            <div className="mb-3">
              <span className="text-xs text-content-muted mb-1 block">写作风格</span>
              <div className="flex flex-wrap gap-2">
                {styles.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStyle(s === style ? "" : s)}
                    className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                      s === style
                        ? "border-brand-600 bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400"
                        : "border-border text-content-muted hover:border-content-muted"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>创建</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowCreate(false)}>取消</Button>
            </div>
          </div>
        )}

        {projects.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={48} />}
            title="还没有小说项目"
            description="点击上方按钮创建或导入"
          />
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="text-left p-5 bg-surface-elevated border border-border hover:border-brand-600/30 rounded-xl transition-all hover:bg-surface-hover"
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
    </div>
  );
}
