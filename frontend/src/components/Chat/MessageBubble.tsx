import type { ChatMessage } from "../../types";
import { Bot, User, Loader2, CheckCircle2 } from "lucide-react";
import { Badge } from "../ui/Badge";

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";
  const toolCalls = message.blocks.filter((b) => b.type === "tool_call");
  const toolResults = message.blocks.filter((b) => b.type === "tool_result");
  const agentStarts = message.blocks.filter((b) => b.type === "agent_start");
  const agentCompletes = message.blocks.filter((b) => b.type === "agent_complete");
  const hasError = message.blocks.some((b) => b.type === "error");
  const hasReview = message.blocks.some((b) => b.type === "review");

  if (isUser) {
    return (
      <div className="flex gap-2 px-4 py-3 justify-end">
        <div className="flex flex-col gap-1 max-w-[85%] items-end">
          <div className="text-xs text-content-muted">你</div>
          <div className="rounded-lg px-3 py-2 text-sm bg-surface-elevated border border-border text-content-primary whitespace-pre-wrap break-words">
            {message.text}
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center shrink-0 mt-0.5">
          <User size={14} className="text-content-secondary" />
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex gap-2 px-4 py-3">
        <div className="w-7 h-7 rounded-full bg-error-bg flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={14} className="text-error" />
        </div>
        <div className="flex flex-col gap-1 max-w-[85%]">
          <div className="text-xs text-error">NovelAI</div>
          <div className="rounded-lg px-3 py-2 text-sm bg-error-bg text-error border border-red-500/20">
            {message.blocks.find((b) => b.type === "error")?.error || "出错了"}
          </div>
        </div>
      </div>
    );
  }

  if (message.isStreaming) {
    return (
      <div className="flex gap-2 px-4 py-3">
        <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center shrink-0 mt-0.5">
          <Bot size={14} className="text-brand-600 dark:text-brand-400" />
        </div>
        <div className="flex flex-col gap-1 max-w-[85%]">
          <div className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1">
            NovelAI
            <Loader2 size={10} className="animate-spin" />
          </div>
          <div className="rounded-lg px-3 py-2 text-sm bg-surface-elevated border border-border text-content-secondary">
            <span className="inline-block w-2 h-4 bg-brand-400 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-4 py-3">
      <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-950 flex items-center justify-center shrink-0 mt-0.5">
        <Bot size={14} className="text-brand-600 dark:text-brand-400" />
      </div>
      <div className="flex flex-col gap-2 max-w-[85%]">
        <div className="text-xs text-brand-600 dark:text-brand-400">NovelAI</div>

        {agentStarts.length > 0 && (
          <div className="flex flex-col gap-1">
            {agentStarts.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Loader2 size={12} className="text-brand-600 dark:text-brand-400 animate-spin" />
                <span className="text-content-primary">{b.agentName}</span>
                {b.content && <span className="text-content-muted">- {b.content}</span>}
              </div>
            ))}
          </div>
        )}

        {toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {toolCalls.map((b, i) => {
              const hasResult = toolResults.some((r) => r.toolName === b.toolName);
              return (
                <Badge
                  key={i}
                  variant={hasResult ? "success" : "default"}
                >
                  {hasResult ? <CheckCircle2 size={10} className="mr-1" /> : <Loader2 size={10} className="animate-spin mr-1" />}
                  {b.toolName}
                </Badge>
              );
            })}
          </div>
        )}

        {message.text && (
          <div className="rounded-lg px-3 py-2 text-sm bg-surface-elevated border border-border text-content-primary whitespace-pre-wrap break-words">
            {message.text}
          </div>
        )}

        {hasReview && (
          <div className="rounded-lg px-3 py-2 bg-brand-50 dark:bg-brand-950 border border-brand-200 dark:border-brand-800">
            {message.blocks
              .filter((b) => b.type === "review" && b.review)
              .map((b, i) => (
                <div key={i} className="text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-sm font-bold ${
                      b.review?.grade === "A" ? "text-success" :
                      b.review?.grade === "B" ? "text-blue-400" :
                      b.review?.grade === "C" ? "text-warning" : "text-error"
                    }`}>
                      {b.review?.grade}
                    </span>
                    <span className="text-content-secondary">{b.review?.summary}</span>
                  </div>
                  {b.review?.details && (
                    <div className="text-content-muted mt-1">{b.review.details}</div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
