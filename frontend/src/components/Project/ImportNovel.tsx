import { useState, useRef } from "react";
import { Upload, FileText, X, Check, AlertCircle, Settings, BookOpen, Plus, Pencil, Trash2, Save, ChevronDown } from "lucide-react";
import { useChapterParser } from "../../hooks/useChapterParser";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { ChapterParseRule } from "../../types";
import { PRESET_PARSE_RULES } from "../../types";

interface Props {
  onComplete: (projectId: string) => void;
  onCancel: () => void;
}

export function ImportNovel({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<"info" | "upload">("info");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<ChapterParseRule>>({});
  const [showPresetPanel, setShowPresetPanel] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parser = useChapterParser();

  const handleAddFromPreset = (preset: ChapterParseRule) => {
    const newId = parser.addRule();
    parser.updateRule(newId, {
      name: preset.name,
      pattern: preset.pattern,
      example: preset.example,
    });
  };

  const handleAddRule = () => {
    const newId = parser.addRule();
    const newRule = parser.rules.find((r) => r.id === newId);
    if (newRule) {
      setEditingRuleId(newId);
      setEditingRule({ name: newRule.name, pattern: newRule.pattern, example: newRule.example });
      setShowSettings(true);
    }
  };

  const handleEditRule = (rule: ChapterParseRule) => {
    setEditingRuleId(rule.id);
    setEditingRule({ name: rule.name, pattern: rule.pattern, example: rule.example });
  };

  const handleSaveRule = () => {
    if (editingRuleId && editingRule.name && editingRule.pattern) {
      parser.updateRule(editingRuleId, {
        name: editingRule.name,
        pattern: editingRule.pattern,
        example: editingRule.example || "",
      });
      setEditingRuleId(null);
      setEditingRule({});
    }
  };

  const handleDeleteRule = (id: string) => {
    parser.deleteRule(id);
    if (editingRuleId === id) {
      setEditingRuleId(null);
      setEditingRule({});
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parser.setError("");
    try {
      const text = await selectedFile.text();
      parser.setContent(text);
    } catch {
      parser.setError("文件读取失败，请确保文件是纯文本格式");
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".txt") || droppedFile.type === "text/plain")) {
      setFile(droppedFile);
      try {
        const text = await droppedFile.text();
        parser.setContent(text);
      } catch {
        parser.setError("文件读取失败");
      }
    } else {
      parser.setError("请上传 .txt 格式的文件");
    }
  };

  const handleConfirm = async () => {
    if (!title.trim()) {
      parser.setError("请输入小说名称");
      return;
    }
    if (parser.parsedChapters.length === 0) {
      parser.setError("请先解析章节");
      return;
    }

    setCreating(true);
    parser.setError("");

    try {
      const projectRes = await fetch("/api/v1/projects/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!projectRes.ok) throw new Error("创建项目失败");
      const project = await projectRes.json();

      const chapterRes = await fetch("/api/v1/chapters/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          chapters: parser.parsedChapters.map((c, i) => ({
            title: c.title,
            content: c.content,
            sort_order: i + 1,
          })),
        }),
      });

      if (!chapterRes.ok) throw new Error("导入章节失败");

      onComplete(project.id);
    } catch (err: any) {
      parser.setError(err.message);
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-elevated border border-border rounded-xl w-[900px] max-h-[90vh] overflow-hidden flex flex-col shadow-lg">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen size={20} className="text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold text-content-primary">导入小说</h2>
          </div>
          <button onClick={onCancel} className="text-content-muted hover:text-content-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {step === "info" && (
          <div className="px-6 py-4 space-y-4">
            <Input
              label="小说名称 *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：斗破苍穹、凡人修仙传"
            />
            <Input
              label="简介（可选）"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简短的简介"
            />
            <div className="pt-2">
              <Button
                onClick={() => {
                  if (!title.trim()) { parser.setError("请输入小说名称"); return; }
                  parser.setError("");
                  setStep("upload");
                }}
              >
                下一步：选择文件
              </Button>
            </div>
          </div>
        )}

        {step === "upload" && (
          <>
            {showSettings && (
              <div className="px-6 py-4 border-b border-border bg-surface-muted max-h-[300px] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-content-primary">章节匹配规则</h3>
                    <div className="relative">
                      <button
                        onClick={() => setShowPresetPanel(!showPresetPanel)}
                        className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                      >
                        <Plus size={12} />
                        从预设添加
                        <ChevronDown size={12} />
                      </button>
                      {showPresetPanel && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-surface-elevated border border-border rounded-lg shadow-lg z-10 max-h-[240px] overflow-y-auto">
                          {PRESET_PARSE_RULES.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                handleAddFromPreset(preset);
                                setShowPresetPanel(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs text-content-secondary hover:bg-surface-hover hover:text-content-primary border-b border-border last:border-b-0"
                            >
                              <div className="font-medium text-content-primary">{preset.name}</div>
                              <div className="text-[10px] text-content-muted font-mono truncate">{preset.pattern}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleAddRule}
                    className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                  >
                    <Plus size={12} />
                    新建规则
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {parser.rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-2 rounded-lg border transition-colors ${
                        rule.enabled
                          ? "border-brand-600/50 bg-brand-50 dark:bg-brand-950"
                          : "border-border bg-surface-hover/50"
                      }`}
                    >
                      {editingRuleId === rule.id ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-content-muted w-16">名称</span>
                            <input
                              value={editingRule.name || ""}
                              onChange={(e) => setEditingRule((p) => ({ ...p, name: e.target.value }))}
                              className="flex-1 bg-surface-base text-xs text-content-primary px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500"
                              placeholder="规则名称"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-content-muted w-16">正则</span>
                            <input
                              value={editingRule.pattern || ""}
                              onChange={(e) => setEditingRule((p) => ({ ...p, pattern: e.target.value }))}
                              className="flex-1 bg-surface-base text-xs text-content-primary px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500 font-mono"
                              placeholder="正则表达式"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-content-muted w-16">示例</span>
                            <input
                              value={editingRule.example || ""}
                              onChange={(e) => setEditingRule((p) => ({ ...p, example: e.target.value }))}
                              className="flex-1 bg-surface-base text-xs text-content-primary px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500"
                              placeholder="匹配示例"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => setEditingRuleId(null)} className="text-xs text-content-muted hover:text-content-primary">
                              取消
                            </button>
                            <button onClick={handleSaveRule} className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline">
                              <Save size={12} />
                              保存
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <button
                            onClick={() => parser.toggleRule(rule.id)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {rule.enabled ? (
                              <Check size={14} className="text-brand-600 dark:text-brand-400" />
                            ) : (
                              <div className="w-3.5 h-3.5 border border-content-muted rounded" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-content-primary font-medium">{rule.name}</div>
                            <div className="text-[10px] text-content-muted font-mono truncate">{rule.pattern}</div>
                            <div className="text-[10px] text-content-muted mt-0.5">例: {rule.example}</div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEditRule(rule)}
                              className="p-1 text-content-muted hover:text-content-primary"
                              title="编辑规则"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule.id)}
                              className="p-1 text-content-muted hover:text-red-400"
                              title="删除规则"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6">
              {!file ? (
                <div
                  className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-brand-600/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input ref={fileInputRef} type="file" accept=".txt,.text" className="hidden" onChange={handleFileSelect} />
                  <Upload size={48} className="mx-auto text-content-muted mb-4" />
                  <p className="text-content-secondary mb-2">点击选择或拖拽小说文件</p>
                  <p className="text-xs text-content-muted">支持 .txt 格式</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-surface-hover/50 rounded-lg">
                    <FileText size={20} className="text-brand-600 dark:text-brand-400" />
                    <div className="flex-1">
                      <div className="text-sm text-content-primary">{file.name}</div>
                      <div className="text-xs text-content-muted">
                        {(parser.content.length / 1024).toFixed(1)} KB · {parser.content.split("\n").length} 行
                      </div>
                    </div>
                    <button onClick={parser.reset} className="text-content-muted hover:text-content-primary transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  {parser.parsedChapters.length === 0 ? (
                    <Button onClick={parser.parseChapters} disabled={parser.loading || !parser.content} className="w-full py-3">
                      {parser.loading ? "解析中..." : "智能解析章节"}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-content-secondary">解析到 {parser.parsedChapters.length} 个章节</span>
                        <div className="flex items-center gap-2">
                          <button onClick={parser.parseChapters} className="text-xs text-brand-600 dark:text-brand-400 hover:underline">
                            重新解析
                          </button>
                          <button
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-1.5 rounded-md transition-colors ${showSettings ? "bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400" : "text-content-muted hover:text-content-primary"}`}
                          >
                            <Settings size={14} />
                          </button>
                        </div>
                      </div>

                      {parser.parsedChapters.map((chapter, index) => (
                        <div key={index} className="border border-border rounded-lg overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2 bg-surface-hover/50">
                            <span className="text-xs text-content-muted w-12">第{index + 1}章</span>
                            <input
                              value={chapter.title}
                              onChange={(e) => parser.updateChapterTitle(index, e.target.value)}
                              className="flex-1 bg-transparent text-sm text-content-primary focus:outline-none"
                            />
                            <button
                              onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
                              className="text-xs text-content-muted hover:text-content-primary px-2"
                            >
                              {previewIndex === index ? "收起" : "预览"}
                            </button>
                            <button
                              onClick={() => parser.removeChapter(index)}
                              className="text-content-muted hover:text-red-400 p-1 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {previewIndex === index && (
                            <div className="px-3 py-2 text-xs text-content-secondary max-h-32 overflow-y-auto whitespace-pre-wrap">
                              {chapter.content.slice(0, 500)}
                              {chapter.content.length > 500 && "..."}
                            </div>
                          )}
                          <div className="px-3 py-1 bg-surface-muted flex items-center gap-2">
                            <span className="text-[10px] text-content-muted">匹配规则: {chapter.matchedPattern}</span>
                            <span className="text-[10px] text-content-muted">字数: {chapter.content.length}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {parser.error && (
                    <div className="flex items-center gap-2 p-3 bg-error-bg border border-red-500/30 rounded-lg text-error text-sm">
                      <AlertCircle size={16} />
                      {parser.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-between">
              <button onClick={() => setStep("info")} className="text-sm text-content-muted hover:text-content-primary transition-colors">
                ← 返回
              </button>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={onCancel}>取消</Button>
                <Button onClick={handleConfirm} disabled={creating || parser.parsedChapters.length === 0}>
                  {creating ? "导入中..." : `创建项目并导入 ${parser.parsedChapters.length} 个章节`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
