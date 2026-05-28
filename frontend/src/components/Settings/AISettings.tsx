import { useState, useEffect } from "react";
import { X, Plus, Check, Trash2, Pencil, Save, Settings, Eye, EyeOff, Loader, Wifi, Download, RefreshCw, BookOpen } from "lucide-react";
import { aiConfigApi, promptsApi, type AIConfig, type AgentPrompt } from "../../api";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { ConfirmDialog } from "../ui/ConfirmDialog";

const AGENT_TYPES = [
  { value: "decision", label: "决策Agent" },
  { value: "continue", label: "续写Agent" },
  { value: "enhance", label: "加料Agent" },
  { value: "rewrite", label: "改写Agent" },
  { value: "supervision", label: "监督Agent" },
  { value: "custom", label: "自定义" },
];

interface Props {
  onClose: () => void;
}

export function AISettings({ onClose }: Props) {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [systemPrompts, setSystemPrompts] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"config" | "prompts">("config");
  const [editingConfig, setEditingConfig] = useState<AIConfig | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<AgentPrompt | null>(null);
  const [showAddConfig, setShowAddConfig] = useState(false);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [showSystemPromptDetail, setShowSystemPromptDetail] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: "config" | "prompt"; item: AIConfig | AgentPrompt } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConfig, setTestingConfig] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [lastTestedConfigId, setLastTestedConfigId] = useState<string | null>(null);
  const [importingEnv, setImportingEnv] = useState(false);
  const [initPromptsLoading, setInitPromptsLoading] = useState(false);

  const [configForm, setConfigForm] = useState({
    name: "",
    category: "",
    api_key: "",
    base_url: "https://api.openai.com/v1",
    model: "gpt-4o",
    temperature: "0.7",
    max_tokens: "4000",
  });

  const [promptForm, setPromptForm] = useState({
    name: "",
    agent_type: "decision",
    content: "",
    description: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsData, promptsData, systemPromptsData, defaultsData] = await Promise.all([
        aiConfigApi.list(),
        promptsApi.list(),
        promptsApi.getSystemPrompts(),
        aiConfigApi.getDefaults(),
      ]);
      setConfigs(configsData);
      setPrompts(promptsData);
      setSystemPrompts(systemPromptsData.prompts || {});
      if (defaultsData.api_key) {
        setConfigForm(prev => ({
          ...prev,
          api_key: defaultsData.api_key,
          base_url: defaultsData.base_url,
          model: defaultsData.model,
        }));
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (configId?: string) => {
    const data = editingConfig
      ? { api_key: editingConfig.api_key || "", base_url: editingConfig.base_url || "", model: editingConfig.model || "" }
      : { api_key: configForm.api_key, base_url: configForm.base_url, model: configForm.model };

    if (!data.api_key) {
      setTestResult({ success: false, error: "API Key 不能为空" });
      setLastTestedConfigId(editingConfig ? editingConfig.id : "new");
      return;
    }

    const targetConfigId = configId || editingConfig?.id || "new";
    setTestingConfig(targetConfigId);
    setLastTestedConfigId(targetConfigId);
    setTestResult(null);

    try {
      const result = await aiConfigApi.testConnection(data);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || "测试失败" });
    } finally {
      setTestingConfig(null);
    }
  };

  const handleImportFromEnv = async () => {
    setImportingEnv(true);
    try {
      const result = await aiConfigApi.importFromEnv();
      if (result.success) {
        await loadData();
      } else {
        setTestResult({ success: false, error: result.error || "导入失败" });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || "导入失败" });
    } finally {
      setImportingEnv(false);
    }
  };

  const handleInitSystemPrompts = async () => {
    setInitPromptsLoading(true);
    try {
      await promptsApi.initSystemPrompts();
      await loadData();
    } catch (err) {
      console.error("Failed to init prompts:", err);
    } finally {
      setInitPromptsLoading(false);
    }
  };

  const handleAddConfig = async () => {
    if (!configForm.name || !configForm.api_key) return;

    try {
      await aiConfigApi.create({
        name: configForm.name,
        category: configForm.category || undefined,
        api_key: configForm.api_key || undefined,
        base_url: configForm.base_url || undefined,
        model: configForm.model || undefined,
        temperature: configForm.temperature || "0.7",
        max_tokens: configForm.max_tokens ? parseInt(configForm.max_tokens) : undefined,
      });

      setShowAddConfig(false);
      setTestResult(null);
      setConfigForm({
        name: "",
        category: "",
        api_key: "",
        base_url: "https://api.openai.com/v1",
        model: "gpt-4o",
        temperature: "0.7",
        max_tokens: "4000",
      });
      await loadData();
    } catch (err) {
      console.error("Failed to add config:", err);
    }
  };

  const handleUpdateConfig = async () => {
    if (!editingConfig) return;
    try {
      await aiConfigApi.update(editingConfig.id, {
        name: editingConfig.name,
        category: editingConfig.category || undefined,
        api_key: editingConfig.api_key || undefined,
        base_url: editingConfig.base_url || undefined,
        model: editingConfig.model || undefined,
        temperature: editingConfig.temperature || "0.7",
        max_tokens: editingConfig.max_tokens ? parseInt(String(editingConfig.max_tokens)) : undefined,
      });

      if (testResult?.success) {
        await aiConfigApi.activate(editingConfig.id);
      }

      setEditingConfig(null);
      setTestResult(null);
      await loadData();
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  };

  const handleActivateConfig = async (id: string) => {
    try {
      await aiConfigApi.activate(id);
      await loadData();
    } catch (err) {
      console.error("Failed to activate config:", err);
    }
  };

  const handleAddPrompt = async () => {
    try {
      await promptsApi.create({
        name: promptForm.name,
        agent_type: promptForm.agent_type,
        content: promptForm.content,
        description: promptForm.description || undefined,
      });
      setShowAddPrompt(false);
      setPromptForm({ name: "", agent_type: "decision", content: "", description: "" });
      await loadData();
    } catch (err) {
      console.error("Failed to add prompt:", err);
    }
  };

  const handleUpdatePrompt = async () => {
    if (!editingPrompt) return;
    try {
      await promptsApi.update(editingPrompt.id, {
        name: editingPrompt.name,
        agent_type: editingPrompt.agent_type || undefined,
        content: editingPrompt.content,
        description: editingPrompt.description || undefined,
      });
      setEditingPrompt(null);
      await loadData();
    } catch (err) {
      console.error("Failed to update prompt:", err);
    }
  };

  const handleActivatePrompt = async (id: string) => {
    try {
      await promptsApi.activate(id);
      await loadData();
    } catch (err) {
      console.error("Failed to activate prompt:", err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === "config") {
        await aiConfigApi.delete(deleteTarget.item.id);
      } else {
        await promptsApi.delete(deleteTarget.item.id);
      }
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setDeleting(false);
    }
  };

  const groupedPrompts = prompts.reduce((acc, prompt) => {
    const type = prompt.agent_type || "custom";
    if (!acc[type]) acc[type] = [];
    acc[type].push(prompt);
    return acc;
  }, {} as Record<string, AgentPrompt[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-elevated border border-border rounded-xl w-[1000px] max-h-[90vh] overflow-hidden flex flex-col shadow-lg">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-brand-600 dark:text-brand-400" />
            <h2 className="text-lg font-semibold text-content-primary">AI 配置与提示词</h2>
          </div>
          <button onClick={onClose} className="text-content-muted hover:text-content-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab("config")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "config"
                ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-600"
                : "text-content-muted hover:text-content-primary"
            }`}
          >
            AI 配置
          </button>
          <button
            onClick={() => setActiveTab("prompts")}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === "prompts"
                ? "text-brand-600 dark:text-brand-400 border-b-2 border-brand-600"
                : "text-content-muted hover:text-content-primary"
            }`}
          >
            提示词模板
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center text-content-muted py-8">加载中...</div>
          ) : activeTab === "config" ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleImportFromEnv} disabled={importingEnv}>
                    <Download size={14} />
                    {importingEnv ? "导入中..." : "从 Env 导入"}
                  </Button>
                </div>
                <Button size="sm" onClick={() => { setShowAddConfig(true); setTestResult(null); }}>
                  <Plus size={14} />
                  添加配置
                </Button>
              </div>

              {configs.length === 0 ? (
                <div className="text-center text-content-muted py-8">暂无配置，点击添加按钮创建或从 Env 导入</div>
              ) : (
                <div className="space-y-3">
                  {configs.map((config) => (
                    <div
                      key={config.id}
                      className={`p-4 rounded-lg border transition-colors ${
                        config.is_active
                          ? "border-success bg-success/10"
                          : "border-border bg-surface-hover/30"
                      }`}
                    >
                      {editingConfig?.id === config.id ? (
                        <div className="space-y-3">
                          <Input
                            label="配置名称"
                            value={editingConfig.name}
                            onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                          />
                          <div className="relative">
                            <Input
                              label="API Key"
                              type={showApiKey ? "text" : "password"}
                              value={editingConfig.api_key || ""}
                              onChange={(e) => setEditingConfig({ ...editingConfig, api_key: e.target.value })}
                            />
                            <button
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-2 top-7 text-content-muted hover:text-content-primary"
                            >
                              {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <Input
                            label="Base URL"
                            value={editingConfig.base_url || ""}
                            onChange={(e) => setEditingConfig({ ...editingConfig, base_url: e.target.value })}
                          />
                          <Input
                            label="模型"
                            value={editingConfig.model || ""}
                            onChange={(e) => setEditingConfig({ ...editingConfig, model: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <Input
                              label="Temperature"
                              value={editingConfig.temperature || "0.7"}
                              onChange={(e) => setEditingConfig({ ...editingConfig, temperature: e.target.value })}
                              className="w-24"
                            />
                            <Input
                              label="Max Tokens"
                              value={editingConfig.max_tokens?.toString() || ""}
                              onChange={(e) => setEditingConfig({ ...editingConfig, max_tokens: parseInt(e.target.value) || undefined })}
                              className="w-24"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleTestConnection()}
                              disabled={testingConfig === editingConfig.id}
                            >
                              <Wifi size={14} className={testResult?.success ? "text-success" : ""} />
                          {testingConfig === editingConfig.id ? "测试中..." : testResult?.success ? "测试成功" : "测试"}
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => setEditingConfig(null)}>取消</Button>
                            <Button size="sm" onClick={handleUpdateConfig}><Save size={14} />保存</Button>
                          </div>
                          {testResult && lastTestedConfigId === editingConfig?.id && (
                            <div className={`text-xs p-2 rounded ${testResult.success ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                              {testResult.success ? testResult.message : testResult.error}
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-content-primary">{config.name}</span>
                                {config.is_active && (
                                  <span className="px-2 py-0.5 text-xs bg-success text-white rounded-full">使用中</span>
                                )}
                                {config.category === "default" && (
                                  <span className="px-2 py-0.5 text-xs bg-surface-hover text-content-muted rounded">Env</span>
                                )}
                              </div>
                              <div className="text-xs text-content-muted mt-1">
                                {config.model} · {config.base_url}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {!config.is_active && (
                                <button
                                  onClick={() => handleActivateConfig(config.id)}
                                  className="p-1.5 text-content-muted hover:text-success"
                                  title="设为默认"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                              <button
                                onClick={() => { setEditingConfig(config); setShowApiKey(false); setTestResult(null); }}
                                className="p-1.5 text-content-muted hover:text-content-primary"
                                title="编辑"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => handleTestConnection(config.id)}
                                className="p-1.5 text-content-muted hover:text-brand-600"
                                title="测试连接"
                              >
                                <Wifi
                                size={16}
                                className={lastTestedConfigId === config.id && testResult?.success ? "text-success" : "text-content-muted hover:text-brand-600"}
                              />
                            </button>
                              <button
                                onClick={() => setDeleteTarget({ type: "config", item: config })}
                                className="p-1.5 text-content-muted hover:text-red-400"
                                title="删除"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                          {lastTestedConfigId === config.id && testResult && !testingConfig && (
                            <div className={`text-xs p-2 rounded mt-2 ${testResult.success ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                              {testResult.success ? testResult.message : testResult.error}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {showAddConfig && (
                <div className="p-4 rounded-lg border border-brand-600 bg-surface-hover/30 space-y-3">
                  <h4 className="font-medium text-content-primary">添加新配置</h4>
                  <Input
                    label="配置名称"
                    value={configForm.name}
                    onChange={(e) => setConfigForm({ ...configForm, name: e.target.value })}
                    placeholder="如：GPT-4 API"
                  />
                  <div className="relative">
                    <Input
                      label="API Key"
                      type={showApiKey ? "text" : "password"}
                      value={configForm.api_key}
                      onChange={(e) => setConfigForm({ ...configForm, api_key: e.target.value })}
                      placeholder="sk-..."
                    />
                    <button
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-7 text-content-muted hover:text-content-primary"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <Input
                    label="Base URL"
                    value={configForm.base_url}
                    onChange={(e) => setConfigForm({ ...configForm, base_url: e.target.value })}
                  />
                  <Input
                    label="模型"
                    value={configForm.model}
                    onChange={(e) => setConfigForm({ ...configForm, model: e.target.value })}
                    placeholder="gpt-4o, gpt-3.5-turbo"
                  />
                  <div className="flex gap-2">
                    <Input
                      label="Temperature"
                      value={configForm.temperature}
                      onChange={(e) => setConfigForm({ ...configForm, temperature: e.target.value })}
                      className="w-24"
                    />
                    <Input
                      label="Max Tokens"
                      value={configForm.max_tokens}
                      onChange={(e) => setConfigForm({ ...configForm, max_tokens: e.target.value })}
                      className="w-24"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="secondary" onClick={() => setShowAddConfig(false)}>取消</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestConnection()}
                      disabled={testingConfig === "new"}
                    >
                      <Wifi size={14} />
                      {testingConfig === "new" ? "测试中..." : "测试"}
                    </Button>
                    <Button size="sm" onClick={handleAddConfig} disabled={!configForm.name || !configForm.api_key}>添加并测试</Button>
                  </div>
                  {testResult && lastTestedConfigId === "new" && !testingConfig && (
                    <div className={`text-xs p-2 rounded ${testResult.success ? "bg-success/20 text-success" : "bg-error/20 text-error"}`}>
                      {testResult.success ? testResult.message : testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleInitSystemPrompts} disabled={initPromptsLoading}>
                    <RefreshCw size={14} className={initPromptsLoading ? "animate-spin" : ""} />
                    {initPromptsLoading ? "初始化中..." : "初始化内置模板"}
                  </Button>
                  <Button size="sm" onClick={() => setShowAddPrompt(true)}>
                    <Plus size={14} />
                    添加自定义模板
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {AGENT_TYPES.map(({ value, label }) => (
                  <div key={value}>
                    <h4 className="text-sm font-medium text-content-primary mb-2">{label}</h4>

                    {systemPrompts[value] && (
                      <div className="mb-2 p-3 rounded-lg border border-surface-muted bg-surface-muted/30">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-content-muted" />
                            <span className="text-sm text-content-secondary">内置模板</span>
                          </div>
                          <button
                            onClick={() => setShowSystemPromptDetail(showSystemPromptDetail === value ? null : value)}
                            className="text-xs text-brand-600 hover:underline"
                          >
                            {showSystemPromptDetail === value ? "收起" : "查看"}
                          </button>
                        </div>
                        {showSystemPromptDetail === value && (
                          <pre className="text-xs text-content-muted whitespace-pre-wrap font-mono bg-surface-base p-2 rounded max-h-48 overflow-y-auto">
                            {systemPrompts[value].content}
                          </pre>
                        )}
                      </div>
                    )}

                    {groupedPrompts[value] && groupedPrompts[value].length > 0 && (
                      <div className="space-y-2">
                        {groupedPrompts[value].map((prompt) => (
                          <div
                            key={prompt.id}
                            className={`p-3 rounded-lg border transition-colors ${
                              prompt.is_active
                                ? "border-success bg-success/10"
                                : "border-border bg-surface-hover/30"
                            }`}
                          >
                            {editingPrompt?.id === prompt.id ? (
                              <div className="space-y-3">
                                <Input
                                  label="名称"
                                  value={editingPrompt.name}
                                  onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                                />
                                <textarea
                                  value={editingPrompt.content}
                                  onChange={(e) => setEditingPrompt({ ...editingPrompt, content: e.target.value })}
                                  className="w-full h-48 px-3 py-2 text-sm bg-surface-base border border-border rounded-lg text-content-primary focus:outline-none focus:border-brand-500 font-mono"
                                  placeholder="输入提示词内容..."
                                />
                                <div className="flex gap-2 justify-end">
                                  <Button variant="secondary" size="sm" onClick={() => setEditingPrompt(null)}>取消</Button>
                                  <Button size="sm" onClick={handleUpdatePrompt}><Save size={14} />保存</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-content-primary">{prompt.name}</span>
                                    {prompt.is_active && (
                                      <span className="px-2 py-0.5 text-xs bg-success text-white rounded-full">使用中</span>
                                    )}
                                    {prompt.is_system && (
                                      <span className="px-2 py-0.5 text-xs bg-surface-hover text-content-muted rounded">内置</span>
                                    )}
                                  </div>
                                  {prompt.description && (
                                    <div className="text-xs text-content-muted mt-0.5">{prompt.description}</div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {!prompt.is_active && (
                                    <button
                                      onClick={() => handleActivatePrompt(prompt.id)}
                                      className="p-1.5 text-content-muted hover:text-success"
                                      title="设为使用"
                                    >
                                      <Check size={16} />
                                    </button>
                                  )}
                                  {!prompt.is_system && (
                                    <>
                                      <button
                                        onClick={() => setEditingPrompt(prompt)}
                                        className="p-1.5 text-content-muted hover:text-content-primary"
                                        title="编辑"
                                      >
                                        <Pencil size={16} />
                                      </button>
                                      <button
                                        onClick={() => setDeleteTarget({ type: "prompt", item: prompt })}
                                        className="p-1.5 text-content-muted hover:text-red-400"
                                        title="删除"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {showAddPrompt && (
                <div className="p-4 rounded-lg border border-brand-600 bg-surface-hover/30 space-y-3">
                  <h4 className="font-medium text-content-primary">添加自定义提示词</h4>
                  <Input
                    label="名称"
                    value={promptForm.name}
                    onChange={(e) => setPromptForm({ ...promptForm, name: e.target.value })}
                  />
                  <div>
                    <label className="text-xs text-content-secondary mb-1 block">Agent 类型</label>
                    <select
                      value={promptForm.agent_type}
                      onChange={(e) => setPromptForm({ ...promptForm, agent_type: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-surface-base border border-border rounded-lg text-content-primary focus:outline-none focus:border-brand-500"
                    >
                      {AGENT_TYPES.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="描述（可选）"
                    value={promptForm.description}
                    onChange={(e) => setPromptForm({ ...promptForm, description: e.target.value })}
                  />
                  <textarea
                    value={promptForm.content}
                    onChange={(e) => setPromptForm({ ...promptForm, content: e.target.value })}
                    className="w-full h-40 px-3 py-2 text-sm bg-surface-base border border-border rounded-lg text-content-primary focus:outline-none focus:border-brand-500 font-mono"
                    placeholder="输入提示词内容..."
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="secondary" size="sm" onClick={() => setShowAddPrompt(false)}>取消</Button>
                    <Button size="sm" onClick={handleAddPrompt} disabled={!promptForm.name || !promptForm.content}>添加</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <Button variant="secondary" onClick={onClose}>关闭</Button>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="确认删除"
        message={`确定要删除"${deleteTarget?.item.name}"吗？此操作不可恢复。`}
        loading={deleting}
      />
    </div>
  );
}