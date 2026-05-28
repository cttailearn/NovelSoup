import { useState, useEffect } from "react";
import { X, Check, Settings, Loader2, Plus, Pencil, Trash2, Save, AlertCircle } from "lucide-react";
import { chaptersApi } from "../../api/chapters";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import type { Chapter, ChapterParseRule } from "../../types";
import { DEFAULT_PARSE_RULES } from "../../types";

interface Props {
  projectId: string;
  chapters: Chapter[];
  onClose: () => void;
  onReparse: (newChapters: Chapter[]) => void;
}

export function ReparseChapters({ projectId, chapters, onClose, onReparse }: Props) {
  const [rules, setRules] = useState<ChapterParseRule[]>(DEFAULT_PARSE_RULES);
  const [showSettings, setShowSettings] = useState(true);
  const [loading, setLoading] = useState(true);
  const [reparsing, setReparsing] = useState(false);
  const [previewChapters, setPreviewChapters] = useState<{ title: string; content: string; word_count: number }[] | null>(null);
  const [error, setError] = useState<string>("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<ChapterParseRule>>({});
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<Partial<ChapterParseRule>>({
    name: "",
    pattern: "",
    example: "",
    enabled: true,
  });

  useEffect(() => {
    loadRules();
  }, [projectId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const result = await chaptersApi.getRules(projectId);
      if (result.rules && result.rules.length > 0) {
        const mergedRules = mergeRules(DEFAULT_PARSE_RULES, result.rules);
        setRules(mergedRules);
      }
    } catch (err) {
      console.error("Failed to load rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const mergeRules = (defaultRules: ChapterParseRule[], savedRules: ChapterParseRule[]): ChapterParseRule[] => {
    const savedPatterns = new Set(savedRules.map(r => r.pattern));
    const customRules = defaultRules.filter(r => !savedPatterns.has(r.pattern));
    return [...savedRules, ...customRules];
  };

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    setPreviewChapters(null);
  };

  const handleAddRule = () => {
    if (!newRule.name || !newRule.pattern) {
      setError("规则名称和匹配模式不能为空");
      return;
    }

    const ruleId = `custom_${Date.now()}`;
    const newRuleItem: ChapterParseRule = {
      id: ruleId,
      name: newRule.name,
      pattern: newRule.pattern,
      example: newRule.example || "",
      enabled: true,
      editable: true,
    };

    setRules((prev) => [...prev, newRuleItem]);
    setNewRule({ name: "", pattern: "", example: "", enabled: true });
    setShowAddRule(false);
    setPreviewChapters(null);
    setError("");
  };

  const handleEditRule = (rule: ChapterParseRule) => {
    if (!rule.editable) {
      setEditingRuleId(rule.id);
      setEditingRule({ name: rule.name, pattern: rule.pattern, example: rule.example });
    }
  };

  const handleSaveEdit = () => {
    if (!editingRuleId || !editingRule.name || !editingRule.pattern) {
      setError("规则名称和匹配模式不能为空");
      return;
    }

    setRules((prev) =>
      prev.map((r) =>
        r.id === editingRuleId
          ? { ...r, name: editingRule.name!, pattern: editingRule.pattern!, example: editingRule.example || "" }
          : r
      )
    );
    setEditingRuleId(null);
    setEditingRule({});
    setPreviewChapters(null);
    setError("");
  };

  const handleDeleteRule = (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (rule && rule.editable) {
      setRules((prev) => prev.filter((r) => r.id !== id));
      setPreviewChapters(null);
    }
  };

  const handleReparse = async () => {
    setReparsing(true);
    setError("");
    setPreviewChapters(null);

    try {
      const combinedContent = chapters.map((c) => `=== ${c.title} ===\n${c.content}`).join("\n\n");
      const result = await chaptersApi.reparse(projectId, combinedContent);
      setPreviewChapters(result.chapters);
    } catch (err: any) {
      setError(err.message || "重新解析失败");
    } finally {
      setReparsing(false);
    }
  };

  const handleApply = async () => {
    if (!previewChapters) return;

    try {
      const customRules = rules.filter((r) => r.editable);
      const allRules = rules.map((r, index) => ({
        ...r,
        sort_order: index,
      }));

      await chaptersApi.saveRules(projectId, allRules);

      const existingChapterIds = new Set(chapters.map(c => c.id));
      const newChapters: Chapter[] = previewChapters.map((ch, index) => {
        const originalChapter = chapters.find((c) => c.title === ch.title || c.sort_order === index + 1);
        return {
          id: originalChapter?.id || `new_${Date.now()}_${index}`,
          project_id: projectId,
          title: ch.title,
          content: ch.content,
          sort_order: index + 1,
          word_count: ch.word_count,
          summary: originalChapter?.summary || "",
          create_time: originalChapter?.create_time || Date.now(),
          update_time: Date.now(),
        };
      });

      onReparse(newChapters);
      onClose();
    } catch (err: any) {
      setError(err.message || "应用失败");
    }
  };

  const isCustomRule = (rule: ChapterParseRule) => {
    if (!rule.id) return false;
    return rule.id.startsWith("custom_") || rule.editable === true;
  };

  const builtinRules = rules.filter(r => !isCustomRule(r));
  const customRules = rules.filter(r => isCustomRule(r));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-elevated border border-border rounded-xl w-[1000px] max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold text-content-primary">章节重新解析</h2>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-content-secondary">
                将 {chapters.length} 个章节的内容重新解析为新的章节结构
              </p>
              <p className="text-xs text-content-muted mt-1">
                当前启用: {rules.filter((r) => r.enabled).length} 个规则，其中 {customRules.length} 个自定义规则
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
              >
                <Settings size={14} />
                {showSettings ? "收起规则" : "设置规则"}
              </Button>
              <Button
                size="sm"
                onClick={handleReparse}
                disabled={reparsing || loading}
              >
                {reparsing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    解析中...
                  </>
                ) : (
                  "预览解析"
                )}
              </Button>
            </div>
          </div>

          {showSettings && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-surface-muted">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-content-primary">内置规则</h3>
                  <span className="text-xs text-content-muted">点击切换启用状态</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {builtinRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                        rule.enabled
                          ? "border-brand-600/50 bg-brand-50 dark:bg-brand-950"
                          : "border-border bg-surface-hover/50"
                      }`}
                      onClick={() => toggleRule(rule.id)}
                    >
                      <div className="mt-0.5">
                        {rule.enabled ? (
                          <Check size={14} className="text-brand-600 dark:text-brand-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 border border-content-muted rounded" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-content-primary font-medium">{rule.name}</div>
                        <div className="text-[10px] text-content-muted font-mono truncate">{rule.pattern}</div>
                        <div className="text-[10px] text-content-muted mt-0.5">例: {rule.example}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-lg border border-brand-600/50 bg-brand-50/30 dark:bg-brand-950/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium text-content-primary">自定义规则</h3>
                    <span className="text-xs text-content-muted">（可添加、编辑、删除）</span>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowAddRule(!showAddRule)}
                  >
                    <Plus size={14} />
                    添加规则
                  </Button>
                </div>

                {showAddRule && (
                  <div className="mb-3 p-3 rounded-lg border border-border bg-surface-base">
                    <h4 className="text-xs font-medium text-content-primary mb-2">新增自定义规则</h4>
                    <div className="space-y-2">
                      <Input
                        placeholder="规则名称，如：我的规则"
                        value={newRule.name || ""}
                        onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                        className="text-sm"
                      />
                      <div>
                        <label className="text-xs text-content-muted">匹配模式（正则表达式）</label>
                        <Input
                          placeholder="^(第[一二三...]+章)\\s*(.+)$"
                          value={newRule.pattern || ""}
                          onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                          className="text-sm font-mono"
                        />
                      </div>
                      <Input
                        placeholder="示例文本（可选）"
                        value={newRule.example || ""}
                        onChange={(e) => setNewRule({ ...newRule, example: e.target.value })}
                        className="text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setShowAddRule(false)}>
                          取消
                        </Button>
                        <Button size="sm" onClick={handleAddRule}>
                          <Check size={14} />
                          添加
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {customRules.length === 0 ? (
                  <div className="text-center py-4 text-xs text-content-muted">
                    暂无自定义规则，点击"添加规则"创建
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customRules.map((rule) => (
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
                            <Input
                              placeholder="规则名称"
                              value={editingRule.name || ""}
                              onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                              className="text-sm"
                            />
                            <Input
                              placeholder="匹配模式（正则表达式）"
                              value={editingRule.pattern || ""}
                              onChange={(e) => setEditingRule({ ...editingRule, pattern: e.target.value })}
                              className="text-sm font-mono"
                            />
                            <Input
                              placeholder="示例文本（可选）"
                              value={editingRule.example || ""}
                              onChange={(e) => setEditingRule({ ...editingRule, example: e.target.value })}
                              className="text-sm"
                            />
                            <div className="flex justify-end gap-2">
                              <Button variant="secondary" size="sm" onClick={() => setEditingRuleId(null)}>
                                取消
                              </Button>
                              <Button size="sm" onClick={handleSaveEdit}>
                                <Save size={14} />
                                保存
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <div
                              className="mt-0.5 cursor-pointer"
                              onClick={() => toggleRule(rule.id)}
                            >
                              {rule.enabled ? (
                                <Check size={14} className="text-brand-600 dark:text-brand-400" />
                              ) : (
                                <div className="w-3.5 h-3.5 border border-content-muted rounded" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-xs text-content-primary font-medium">{rule.name}</div>
                              </div>
                              <div className="text-[10px] text-content-muted font-mono truncate">{rule.pattern}</div>
                              <div className="text-[10px] text-content-muted mt-0.5">例: {rule.example || "无"}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditRule(rule)}
                                className="p-1 text-content-muted hover:text-brand-600 transition-colors"
                                title="编辑规则"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-1 text-content-muted hover:text-red-500 transition-colors"
                                title="删除规则"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-surface-muted border border-border">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="text-brand-600 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-content-muted">
                    <p className="font-medium text-content-primary mb-1">正则表达式说明</p>
                    <p className="mb-1">• ^ 表示匹配行首</p>
                    <p className="mb-1">• () 捕获匹配的内容，第一组是章节标题</p>
                    <p className="mb-1">• [一二三四...] 匹配中文数字</p>
                    <p className="mb-1">• \\d+ 匹配阿拉伯数字</p>
                    <p>• \\s* 匹配零个或多个空白字符</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-error/20 border border-error/30 text-error text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {previewChapters && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-content-primary">
                  解析预览 ({previewChapters.length} 个章节)
                </h3>
                <span className="text-xs text-content-muted">
                  共 {previewChapters.reduce((sum, ch) => sum + ch.word_count, 0).toLocaleString()} 字
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto space-y-2">
                {previewChapters.map((ch, index) => (
                  <div key={index} className="p-3 rounded-lg border border-border bg-surface-hover/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-content-primary">
                        第{index + 1}章 {ch.title}
                      </span>
                      <span className="text-xs text-content-muted">
                        {ch.word_count.toLocaleString()} 字
                      </span>
                    </div>
                    <div className="text-xs text-content-secondary line-clamp-2">
                      {ch.content.slice(0, 200)}
                      {ch.content.length > 200 && "..."}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleApply} disabled={!previewChapters}>
            <Check size={14} />
            应用解析结果
          </Button>
        </div>
      </div>
    </div>
  );
}
