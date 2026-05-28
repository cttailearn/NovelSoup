import { useState, useEffect } from "react";
import { X, Settings, Play, Check, RefreshCw, Save, Plus, Loader, Pencil, Trash2 } from "lucide-react";
import { characterExtractApi, type ExtractField } from "../../api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";

interface Chapter {
  id: string;
  title: string;
  sort_order: number;
}

interface Props {
  projectId: string;
  onClose: () => void;
  onRefresh: () => void;
}

export function CharacterExtractPanel({ projectId, onClose, onRefresh }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [extractedChapterIds, setExtractedChapterIds] = useState<Set<string>>(new Set());
  const [availableFields, setAvailableFields] = useState<ExtractField[]>([]);
  const [fields, setFields] = useState<ExtractField[]>([]);
  const [showFieldSettings, setShowFieldSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [lastResult, setLastResult] = useState<any>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<Partial<ExtractField>>({});

  useEffect(() => {
    loadChapters();
    loadAvailableFields();
    loadConfig();
    loadRecords();
  }, [projectId]);

  const loadChapters = async () => {
    try {
      const res = await fetch(`/api/v1/chapters/project/${projectId}`);
      const data = await res.json();
      setChapters(data);
    } catch (err) {
      console.error("Failed to load chapters:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableFields = async () => {
    try {
      const res = await characterExtractApi.getAvailableFields();
      setAvailableFields(res.fields);
    } catch (err) {
      console.error("Failed to load available fields:", err);
    }
  };

  const loadConfig = async () => {
    try {
      const config = await characterExtractApi.getConfig(projectId);
      if (config.fields && config.fields.length > 0) {
        const mergedFields = availableFields.length > 0
          ? availableFields.map((bf) => {
              const userField = config.fields.find((f: ExtractField) => f.field === bf.field);
              return userField ? { ...bf, ...userField, enabled: true } : { ...bf, enabled: true };
            })
          : config.fields.map((f: ExtractField) => ({ ...f, enabled: true }));
        setFields(mergedFields.length > 0 ? mergedFields : availableFields.map(f => ({ ...f, enabled: true })));
      } else {
        setFields(availableFields.map(f => ({ ...f, enabled: true })));
      }
    } catch (err) {
      console.error("Failed to load config:", err);
      setFields(availableFields.map(f => ({ ...f, enabled: true })));
    }
  };

  const loadRecords = async () => {
    try {
      const data = await characterExtractApi.getRecords(projectId);
      const extractedIds = new Set<string>();
      data.forEach((record: any) => {
        if (record.chapter_ids) {
          record.chapter_ids.split(",").forEach((id: string) => {
            if (id.trim()) extractedIds.add(id.trim());
          });
        }
      });
      setExtractedChapterIds(extractedIds);
    } catch (err) {
      console.error("Failed to load records:", err);
    }
  };

  useEffect(() => {
    if (availableFields.length > 0 && fields.length === 0) {
      setFields(availableFields.map(f => ({ ...f, enabled: true })));
    }
  }, [availableFields]);

  const handleFieldToggle = (field: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.field === field ? { ...f, enabled: !f.enabled } : f
      )
    );
  };

  const handleFieldRequiredToggle = (field: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.field === field ? { ...f, required: !f.required } : f
      )
    );
  };

  const handleAddField = () => {
    const newField: ExtractField = {
      field: `custom_${Date.now()}`,
      label: "新字段",
      type: "text",
      required: false,
      description: "自定义字段描述",
      enabled: true,
    };
    setFields((prev) => [...prev, newField]);
    setEditingFieldId(newField.field);
    setEditingField({ label: "新字段", type: "text", required: false, description: "自定义字段描述" });
  };

  const handleEditField = (field: string) => {
    const f = fields.find((f) => f.field === field);
    if (f) {
      setEditingFieldId(field);
      setEditingField({ label: f.label, type: f.type || "text", required: f.required, description: f.description });
    }
  };

  const handleSaveField = () => {
    if (editingFieldId && editingField.label) {
      setFields((prev) =>
        prev.map((f) =>
          f.field === editingFieldId ? { ...f, ...editingField, field: editingFieldId } : f
        )
      );
      setEditingFieldId(null);
      setEditingField({});
    }
  };

  const handleDeleteField = (field: string) => {
    const isBuiltin = availableFields.some((af) => af.field === field);
    if (isBuiltin) return;
    setFields((prev) => prev.filter((f) => f.field !== field));
    if (editingFieldId === field) {
      setEditingFieldId(null);
      setEditingField({});
    }
  };

  const handleSaveConfig = async () => {
    try {
      await characterExtractApi.updateConfig(projectId, fields);
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  };

  const toggleChapterSelection = (id: string) => {
    setSelectedChapters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const unextracted = chapters.filter((ch) => !extractedChapterIds.has(ch.id)).map((ch) => ch.id);
    setSelectedChapters(unextracted);
  };

  const clearSelection = () => {
    setSelectedChapters([]);
  };

  const handleExtract = async () => {
    if (selectedChapters.length === 0) return;

    setExtracting(true);
    setProgress(0);
    setLastResult(null);

    setProgressText("正在调用 AI 模型分析章节...");
    setProgress(10);

    try {
      const result = await characterExtractApi.extract(projectId, selectedChapters.join(","));

      setProgress(100);
      setProgressText("提取完成");

      setLastResult(result);
      loadRecords();
      onRefresh();
      setSelectedChapters([]);

      setTimeout(() => {
        setProgress(0);
        setProgressText("");
      }, 2000);
    } catch (err: any) {
      console.error("Failed to extract:", err);
      let errorMessage = "未知错误";
      if (err.message) {
        const match = err.message.match(/API request failed: (.+)/);
        errorMessage = match ? match[1] : err.message;
      }
      setProgressText(`提取失败: ${errorMessage}`);
      setLastResult({ success: false, extracted_count: 0, merged_count: 0, characters: [] });
      setTimeout(() => {
        setProgress(0);
        setProgressText("");
      }, 5000);
    } finally {
      setExtracting(false);
    }
  };

  const enabledFields = fields.filter((f) => f.enabled);
  const requiredFields = fields.filter((f) => f.required && f.enabled);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-surface-elevated border border-border rounded-xl w-[900px] max-h-[85vh] overflow-hidden flex flex-col shadow-xl relative z-[61]">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw size={20} className="text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold text-content-primary">智能提取人物</h2>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {extracting && progress > 0 && (
            <div className="p-4 bg-surface-muted rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Loader size={16} className="animate-spin text-brand-600" />
                <span className="text-sm text-content-primary">{progressText}</span>
              </div>
              <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="p-4 bg-surface-muted rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-content-muted" />
                <h3 className="text-sm font-medium text-content-primary">提取字段配置</h3>
                <span className="text-xs text-content-muted">（已启用 {enabledFields.length} 个字段）</span>
              </div>
              <button
                onClick={() => setShowFieldSettings(!showFieldSettings)}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
              >
                {showFieldSettings ? "收起" : "编辑"}
              </button>
            </div>

            {showFieldSettings ? (
              <div className="space-y-4">
                <div className="text-xs text-content-muted mb-2">
                  点击字段可启用/禁用，点击 <Check size={10} className="inline" /> 可设为必填。自定义字段可编辑或删除。
                </div>
                <div className="space-y-3">
                  <div className="text-xs text-content-muted font-medium">内置字段</div>
                  <div className="grid grid-cols-2 gap-2">
                    {availableFields.map((f) => {
                      const userField = fields.find((uf) => uf.field === f.field);
                      const isEnabled = userField?.enabled ?? true;
                      const isRequired = userField?.required ?? f.required;
                      return (
                        <div
                          key={f.field}
                          className="p-3 rounded-lg border transition-colors"
                        >
                          <div className="flex items-start gap-2">
                            <div
                              onClick={() => handleFieldToggle(f.field)}
                              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 ${
                                isEnabled
                                  ? "border-brand-600 bg-brand-600"
                                  : "border-border"
                              }`}
                            >
                              {isEnabled && <Check size={12} className="text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-content-primary font-medium">{f.label}</span>
                                {isRequired && (
                                  <button
                                    onClick={() => handleFieldRequiredToggle(f.field)}
                                    className="p-0.5 text-success"
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                              </div>
                              <div className="text-xs text-content-muted mt-0.5">{f.description}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="text-xs text-content-muted font-medium">自定义字段</div>
                    <button
                      onClick={handleAddField}
                      className="flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
                    >
                      <Plus size={12} />
                      新增字段
                    </button>
                  </div>
                  {fields.filter((f) => !availableFields.some((af) => af.field === f.field)).length === 0 ? (
                    <div className="text-xs text-content-muted text-center py-2">暂无自定义字段</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {fields.filter((f) => !availableFields.some((af) => af.field === f.field)).map((f) => {
                        const isEnabled = f.enabled ?? true;
                        const isEditing = editingFieldId === f.field;
                        return (
                          <div
                            key={f.field}
                            className="p-3 rounded-lg border transition-colors bg-surface-hover/30"
                          >
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  value={editingField.label || ""}
                                  onChange={(e) => setEditingField((p) => ({ ...p, label: e.target.value }))}
                                  className="w-full bg-surface-base text-xs text-content-primary px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500"
                                  placeholder="字段名称"
                                />
                                <select
                                  value={editingField.type || "text"}
                                  onChange={(e) => setEditingField((p) => ({ ...p, type: e.target.value }))}
                                  className="w-full bg-surface-base text-xs text-content-primary px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500"
                                >
                                  <option value="text">文本</option>
                                  <option value="textarea">多行文本</option>
                                  <option value="object">对象</option>
                                </select>
                                <input
                                  value={editingField.description || ""}
                                  onChange={(e) => setEditingField((p) => ({ ...p, description: e.target.value }))}
                                  className="w-full bg-surface-base text-xs text-content-primary px-2 py-1 rounded border border-border focus:outline-none focus:border-brand-500"
                                  placeholder="字段描述"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => { setEditingFieldId(null); setEditingField({}); }}
                                    className="text-xs text-content-muted hover:text-content-primary"
                                  >
                                    取消
                                  </button>
                                  <button
                                    onClick={handleSaveField}
                                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
                                  >
                                    保存
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <div
                                  onClick={() => handleFieldToggle(f.field)}
                                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center cursor-pointer flex-shrink-0 ${
                                    isEnabled
                                      ? "border-brand-600 bg-brand-600"
                                      : "border-border"
                                  }`}
                                >
                                  {isEnabled && <Check size={12} className="text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-content-primary font-medium">{f.label}</span>
                                    {f.required && (
                                      <span className="text-[10px] text-error">必填</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-content-muted mt-0.5">{f.description}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleEditField(f.field)}
                                    className="p-1 text-content-muted hover:text-content-primary"
                                    title="编辑"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteField(f.field)}
                                    className="p-1 text-content-muted hover:text-red-400"
                                    title="删除"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="secondary" onClick={() => {
                    setFields(availableFields.map(f => ({ ...f, enabled: true, required: f.required })));
                  }}>
                    重置
                  </Button>
                  <Button size="sm" onClick={handleSaveConfig}>
                    <Save size={12} />
                    保存配置
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {requiredFields.map((f) => (
                  <span key={f.field} className="px-2 py-1 text-xs bg-brand-600 text-white rounded">
                    {f.label} *
                  </span>
                ))}
                {enabledFields.filter((f) => !f.required).map((f) => (
                  <span key={f.field} className="px-2 py-1 text-xs bg-brand-600/20 text-brand-600 dark:text-brand-400 rounded">
                    {f.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-surface-muted rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-content-primary">选择章节</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-success">已提取: {extractedChapterIds.size}</span>
                <span className="text-content-muted">/</span>
                <span>总计: {chapters.length}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Button size="sm" variant="secondary" onClick={selectAll}>选择未提取</Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>清空</Button>
            </div>
            <div className="max-h-48 overflow-y-auto border border-border rounded-lg p-2">
              {chapters.map((ch) => {
                const isExtracted = extractedChapterIds.has(ch.id);
                const isSelected = selectedChapters.includes(ch.id);
                return (
                  <label
                    key={ch.id}
                    className={`flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover rounded cursor-pointer ${
                      isExtracted ? "opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleChapterSelection(ch.id)}
                      disabled={isExtracted}
                      className="accent-brand-600"
                    />
                    <span className="text-sm text-content-secondary">
                      第{ch.sort_order}章 {ch.title}
                    </span>
                    {isExtracted && (
                      <span className="ml-auto text-xs text-success flex items-center gap-1">
                        <Check size={12} />
                        已提取
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleExtract}
              disabled={extracting || selectedChapters.length === 0}
            >
              <Play size={16} />
              {extracting ? "提取中..." : `提取 ${selectedChapters.length} 章`}
            </Button>
          </div>

          {lastResult && (
            <div className="p-4 bg-surface-muted rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-content-primary">提取结果</h3>
                <div className="flex items-center gap-4 text-xs text-content-muted">
                  <span>提取: {lastResult.extracted_count} 个</span>
                  <span>保存: {lastResult.merged_count} 个</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  );
}