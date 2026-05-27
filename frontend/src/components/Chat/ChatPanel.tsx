import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "../../types";
import { MessageBubble } from "./MessageBubble";
import { Send, Wifi, WifiOff, Plus, ChevronDown, ChevronUp, Loader2, CheckCircle2, Circle, Clock, Bot, Wrench, AlertCircle, MousePointer2 } from "lucide-react";
import type { ExecutionStep } from "../../types";
import { Button } from "../ui/Button";

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  connected: boolean;
  selectedText: string;
  projectId: string;
  chapterId: string | null;
  currentAgentPhase: string;
  executionSteps: ExecutionStep[];
  lastGeneratedContent: string;
  onSend: (text: string, chapterId?: string, selectedText?: string, action?: string) => void;
  onAcceptContent: (content: string, agentName?: string) => void;
  onInsertToEditor: () => void;
  onClearGenerated: () => void;
}

const QUICK_ACTIONS = [
  { label: "加料描写", action: "enhance", hint: "选中内容后可用", requireSelect: true },
  { label: "续写", action: "continue", hint: "在当前位置续写", requireSelect: false },
  { label: "改写风格", action: "rewrite", hint: "选中内容后可用", requireSelect: true },
  { label: "扩写", action: "expand", hint: "选中内容后可用", requireSelect: true },
];

export function ChatPanel({
  messages,
  isStreaming,
  connected,
  selectedText,
  projectId,
  chapterId,
  currentAgentPhase,
  executionSteps,
  lastGeneratedContent,
  onSend,
  onAcceptContent,
  onInsertToEditor,
  onClearGenerated,
}: Props) {
  const [input, setInput] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [showAcceptBanner, setShowAcceptBanner] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setShowResult(false);
      setShowAcceptBanner(false);
      return;
    }
  }, [messages]);

  useEffect(() => {
    if (lastGeneratedContent && !isStreaming) {
      setShowAcceptBanner(true);
      setShowResult(false);
    }
  }, [lastGeneratedContent, isStreaming]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    setShowAcceptBanner(false);
    setShowResult(false);
    onSend(input, chapterId || undefined, selectedText || undefined);
    setInput("");
  };

  const handleQuickAction = (action: string) => {
    if (isStreaming) return;
    setShowAcceptBanner(false);
    setShowResult(false);
    
    const actionConfig = QUICK_ACTIONS.find((qa) => qa.action === action);
    if (actionConfig?.requireSelect && !selectedText) {
      return;
    }
    
    let text = input.trim();
    if (action === "enhance") {
      if (selectedText) {
        text = `请对以下内容进行加料描写（增加环境描写和心理活动）：\n\n${selectedText}`;
      } else {
        text = text || "请加一些环境描写和心理活动";
      }
    } else if (action === "continue") {
      text = text || "请在当前光标位置续写内容";
    } else if (action === "rewrite") {
      if (selectedText) {
        text = `请改写以下内容，优化语言表达：\n\n${selectedText}`;
      } else {
        text = text || "请改写内容";
      }
    } else if (action === "expand") {
      if (selectedText) {
        text = `请扩写以下内容，增加细节和情节：\n\n${selectedText}`;
      } else {
        text = text || "请扩写内容";
      }
    }
    onSend(text, chapterId || undefined, selectedText || undefined, action);
    setInput("");
  };

  const handleViewResult = () => {
    setShowResult(!showResult);
    if (!showResult && lastGeneratedContent) {
      onAcceptContent(lastGeneratedContent, "AI创作");
    }
  };

  const lastAssistantMsg = messages.filter((m) => m.role === "assistant").pop();

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-surface-muted">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-content-primary">AI 创作</h3>
          {connected ? (
            <Wifi size={12} className="text-success" />
          ) : (
            <WifiOff size={12} className="text-error" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {currentAgentPhase && (
            <span className="text-xs text-brand-600 dark:text-brand-400">{currentAgentPhase}</span>
          )}
          {isStreaming && <Loader2 size={12} className="text-brand-600 dark:text-brand-400 animate-spin" />}
        </div>
      </div>

      {executionSteps.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50 bg-surface-muted max-h-48 overflow-y-auto">
          <div className="text-xs text-content-muted mb-2 flex items-center gap-1">
            <Clock size={10} />
            执行流程
          </div>
          <div className="flex flex-col gap-1.5">
            {executionSteps.map((step, i) => (
              <div key={step.id} className="flex items-start gap-2">
                <div className="w-5 h-5 flex items-center justify-center mt-0.5">
                  {step.status === "done" ? (
                    <CheckCircle2 size={16} className="text-success" />
                  ) : step.status === "active" ? (
                    <Loader2 size={14} className="text-brand-600 dark:text-brand-400 animate-spin" />
                  ) : step.status === "error" ? (
                    <AlertCircle size={14} className="text-error" />
                  ) : (
                    <Circle size={14} className="text-content-muted" />
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    {step.type === "agent" ? (
                      <Bot size={10} className={step.status === "done" ? "text-success" : step.status === "active" ? "text-brand-600 dark:text-brand-400" : "text-content-muted"} />
                    ) : (
                      <Wrench size={10} className={step.status === "done" ? "text-success" : step.status === "active" ? "text-brand-600 dark:text-brand-400" : "text-content-muted"} />
                    )}
                    <span className={`text-xs ${
                      step.status === "done"
                        ? "text-content-secondary"
                        : step.status === "active"
                        ? "text-content-primary"
                        : step.status === "error"
                        ? "text-error"
                        : "text-content-muted"
                    }`}>
                      {step.name}
                    </span>
                  </div>
                  {step.status === "active" && step.description && (
                    <span className="text-xs text-content-muted ml-4">{step.description}</span>
                  )}
                  {step.status === "error" && step.error && (
                    <span className="text-xs text-error ml-4">{step.error}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAcceptBanner && lastGeneratedContent && (
        <div className="px-4 py-3 bg-brand-50 dark:bg-brand-950 border-b border-brand-200 dark:border-brand-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-success" />
              <span className="text-xs text-brand-600 dark:text-brand-400 font-medium">生成完成</span>
            </div>
            <button
              onClick={() => setShowAcceptBanner(false)}
              className="text-content-muted hover:text-content-primary transition-colors"
            >
              <ChevronUp size={14} />
            </button>
          </div>
          <div className="text-xs text-content-secondary mb-3 line-clamp-2">
            {lastGeneratedContent.slice(0, 100)}...
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleViewResult} className="flex-1">
              <ChevronDown size={12} />
              查看结果
            </Button>
            <Button size="sm" variant="secondary" onClick={onInsertToEditor} className="flex-1">
              <Plus size={12} />
              插入章节
            </Button>
          </div>
        </div>
      )}

      {showResult && lastAssistantMsg && (
        <div className="border-b border-border max-h-72 overflow-y-auto">
          <div className="px-4 py-2 bg-surface-muted flex items-center justify-between sticky top-0">
            <span className="text-xs text-content-secondary">生成结果</span>
            <button onClick={() => setShowResult(false)} className="text-content-muted hover:text-content-primary transition-colors">
              <ChevronUp size={14} />
            </button>
          </div>
          <div className="px-4 py-3 text-sm text-content-primary whitespace-pre-wrap">
            {lastAssistantMsg.text || "无内容"}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-content-muted px-4 text-center">
            <p className="text-sm mb-4">选择章节，开始与 AI 协作创作</p>
            {!selectedText && (
              <div className="flex items-center gap-1.5 text-xs text-content-muted mb-4 px-3 py-2 bg-surface-hover rounded-lg">
                <MousePointer2 size={12} />
                <span>在编辑器中选中内容，可使用更多功能</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.action}
                  onClick={() => handleQuickAction(qa.action)}
                  disabled={isStreaming || qa.requireSelect && !selectedText}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    qa.requireSelect && !selectedText
                      ? "bg-surface-muted text-content-muted cursor-not-allowed border-border/50"
                      : "bg-surface-hover hover:bg-surface-elevated border border-border text-content-secondary hover:text-content-primary"
                  }`}
                  title={qa.requireSelect && !selectedText ? "请先在编辑器中选择内容" : qa.hint}
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.slice(0, -1).map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {lastAssistantMsg && !isStreaming && (
              <MessageBubble key={lastAssistantMsg.id} message={lastAssistantMsg} />
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border">
        {selectedText && (
          <div className="mb-2 px-2 py-1 bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800 rounded text-xs text-brand-600 dark:text-brand-400 truncate">
            已选中: {selectedText.slice(0, 50)}...
          </div>
        )}
        <div className="flex gap-2 mb-2">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.action}
              onClick={() => handleQuickAction(qa.action)}
              disabled={isStreaming || (qa.requireSelect && !selectedText)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                qa.requireSelect && !selectedText
                  ? "bg-surface-muted text-content-muted cursor-not-allowed border-border/50"
                  : "bg-surface-hover hover:bg-surface-elevated border-border text-content-secondary disabled:opacity-50"
              }`}
              title={qa.requireSelect && !selectedText ? "请先在编辑器中选择内容" : qa.hint}
            >
              {qa.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="输入创作指令..."
            disabled={isStreaming}
            className="flex-1 bg-surface-elevated border border-border rounded-md px-3 py-2 text-sm text-content-primary placeholder-content-muted focus:outline-none focus:ring-2 focus:ring-brand-600/50 focus:border-brand-600 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-surface-hover disabled:text-content-muted rounded-md text-white text-sm transition-colors"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
