import { useState, useEffect, useCallback } from "react";
import type { Character } from "../../types";
import { Plus, Trash2, Edit3, X, Save, RefreshCw } from "lucide-react";
import { Button } from "../ui/Button";
import { Input, Textarea } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { CharacterExtractPanel } from "./CharacterExtractPanel";

interface Props {
  projectId: string;
}

export function CharacterBoard({ projectId }: Props) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Character | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Character | null>(null);
  const [showExtractPanel, setShowExtractPanel] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTraits, setFormTraits] = useState("");

  const loadCharacters = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/characters/project/${projectId}`);
      const data = await res.json();
      setCharacters(data);
    } catch (err) {
      console.error("Failed to load characters:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormTraits("");
    setEditing(null);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;

    try {
      const traitsObj = formTraits
        ? Object.fromEntries(
            formTraits.split(",").map((s) => {
              const [k, v] = s.split(":");
              return [k.trim(), (v || "").trim()];
            })
          )
        : {};
      const traitsJson = JSON.stringify(traitsObj);

      if (editing) {
        const res = await fetch(`/api/v1/characters/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim(),
            traits: traitsJson,
          }),
        });
        if (res.ok) {
          loadCharacters();
          resetForm();
        }
      } else {
        const res = await fetch("/api/v1/characters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            name: formName.trim(),
            description: formDescription.trim(),
            traits: traitsJson,
          }),
        });
        if (res.ok) {
          loadCharacters();
          resetForm();
        }
      }
    } catch (err) {
      console.error("Failed to save character:", err);
    }
  };

  const parseTraits = (traits: string | Record<string, string> | null): Record<string, string> => {
    if (!traits) return {};
    if (typeof traits === "string") {
      try { return JSON.parse(traits); } catch { return {}; }
    }
    return traits;
  };

  const handleEdit = (c: Character) => {
    setEditing(c);
    setCreating(true);
    setFormName(c.name);
    setFormDescription(c.description || "");
    const traitsObj = parseTraits(c.traits);
    setFormTraits(
      Object.entries(traitsObj)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/v1/characters/${deleteTarget.id}`, { method: "DELETE" });
      setCharacters((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Failed to delete character:", err);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-content-primary">人物管理</h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowExtractPanel(true)}
          >
            <RefreshCw size={14} />
            AI 提取
          </Button>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreating(true);
            }}
          >
            <Plus size={14} />
            添加人物
          </Button>
        </div>
      </div>

      {creating && (
        <div className="mb-6 p-4 bg-surface-elevated border border-border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-content-primary">
              {editing ? "编辑人物" : "新建人物"}
            </h3>
            <button onClick={resetForm} className="text-content-muted hover:text-content-primary transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="人物名称"
            />
            <Textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="人物描述、背景故事"
              rows={3}
            />
            <Input
              value={formTraits}
              onChange={(e) => setFormTraits(e.target.value)}
              placeholder="性格特征（如: 内敛: 沉默寡言, 善良: 乐于助人）"
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!formName.trim()}
            >
              <Save size={12} />
              {editing ? "更新" : "创建"}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center text-content-muted py-12">加载中...</div>
      ) : characters.length === 0 ? (
        <EmptyState
          title="暂无人物"
          description="点击上方按钮创建"
          action={
            <Button size="sm" onClick={() => { resetForm(); setCreating(true); }}>
              <Plus size={14} />
              添加人物
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <div
              key={c.id}
              className="p-4 bg-surface-elevated border border-border rounded-lg hover:border-brand-600/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-content-primary">{c.name}</h4>
                  <span className={`text-xs ${c.status === "active" ? "text-success" : "text-content-muted"}`}>
                    {c.status === "active" ? "活跃" : c.status}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(c)}
                    className="p-1 hover:bg-surface-hover rounded text-content-muted hover:text-content-secondary transition-colors"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(c)}
                    className="p-1 hover:bg-surface-hover rounded text-content-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {c.description && (
                <p className="text-sm text-content-secondary mb-2">{c.description}</p>
              )}
              {(() => {
                const displayTraits = parseTraits(c.traits);
                return Object.keys(displayTraits).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(displayTraits).map(([k, v]) => (
                      <span
                        key={k}
                        className="px-2 py-0.5 text-xs rounded bg-surface-hover text-content-secondary"
                      >
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除人物"
        message={`确定要删除「${deleteTarget?.name}」吗？此操作不可撤销。`}
      />

      {showExtractPanel && (
        <CharacterExtractPanel
          projectId={projectId}
          onClose={() => setShowExtractPanel(false)}
          onRefresh={loadCharacters}
        />
      )}
    </div>
  );
}
