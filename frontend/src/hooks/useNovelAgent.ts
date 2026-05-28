import { useState, useCallback, useRef, useEffect } from "react";
import type { ChatMessage, MessageBlock, ExecutionStep } from "../types";

interface UseNovelAgentOptions {
  projectId?: string | null;
  wsUrl?: string;
}

export function useNovelAgent({ projectId, wsUrl }: UseNovelAgentOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentAgentPhase, setCurrentAgentPhase] = useState<string>("");
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const currentMessageRef = useRef<string | null>(null);
  const lastContentRef = useRef("");
  const textBufferRef = useRef("");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const executionStepsRef = useRef<ExecutionStep[]>([]);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageHandlerRef = useRef<((chunk: MessageBlock) => void) | null>(null);

  executionStepsRef.current = executionSteps;

  const getWsUrl = useCallback(() => {
    if (wsUrl) return wsUrl;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws/novel`;
  }, [wsUrl]);

  const flushTextBuffer = useCallback(() => {
    const msgId = currentMessageRef.current;
    if (!msgId || !textBufferRef.current) return;

    lastContentRef.current += textBufferRef.current;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          text: m.text + textBufferRef.current,
        };
      })
    );
    textBufferRef.current = "";
  }, []);

  const addStep = useCallback((type: "agent" | "tool", name: string, description?: string) => {
    const step: ExecutionStep = {
      id: crypto.randomUUID(),
      type,
      name,
      description,
      status: "active",
    };
    setExecutionSteps((prev) => [...prev, step]);
    return step.id;
  }, []);

  const updateStepStatus = useCallback((id: string, status: "done" | "error", error?: string) => {
    setExecutionSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, error } : s))
    );
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messageHandlerRef.current?.(data);
      } catch {
        console.error("Failed to parse WebSocket message");
      }
    };

    wsRef.current = ws;
  }, [getWsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  messageHandlerRef.current = (chunk: MessageBlock) => {
    const msgId = currentMessageRef.current;
    if (!msgId) return;

    switch (chunk.type) {
      case "thinking":
        setCurrentAgentPhase("正在思考...");
        break;

      case "tool_call":
        setCurrentAgentPhase(`执行 ${chunk.toolName}...`);
        addStep("tool", chunk.toolName || "工具");
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              blocks: [...m.blocks, { type: "tool_call", toolName: chunk.toolName, toolArgs: chunk.toolArgs }],
            };
          })
        );
        break;

      case "tool_result": {
        const lastToolStep = executionStepsRef.current
          .filter((s) => s.type === "tool" && s.status === "active")
          .pop();
        if (lastToolStep) {
          updateStepStatus(lastToolStep.id, "done");
        }
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              blocks: [...m.blocks, { type: "tool_result", toolName: chunk.toolName }],
            };
          })
        );
        break;
      }

      case "agent_start":
        setCurrentAgentPhase(chunk.content || `执行 ${chunk.agentName}...`);
        addStep("agent", chunk.agentName || "Agent", chunk.content);
        break;

      case "agent_complete": {
        const lastAgentStep = executionStepsRef.current
          .filter((s) => s.type === "agent" && s.status === "active")
          .pop();
        if (lastAgentStep) {
          updateStepStatus(lastAgentStep.id, "done");
        }
        break;
      }

      case "content:update":
        if (chunk.content) {
          textBufferRef.current += chunk.content;
          setCurrentAgentPhase("生成内容...");
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current);
          }
          flushTimerRef.current = setTimeout(flushTextBuffer, 300);
        }
        break;

      case "review":
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              blocks: [...m.blocks, { type: "review" as const, review: chunk.review }],
            };
          })
        );
        break;

      case "done":
        flushTextBuffer();
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              text: lastContentRef.current,
              blocks: [...m.blocks, { type: "done" }],
              isStreaming: false,
            };
          })
        );
        setIsStreaming(false);
        setCurrentAgentPhase("完成");
        setExecutionSteps((prev) =>
          prev.map((s) => (s.status === "active" ? { ...s, status: "done" } : s))
        );
        currentMessageRef.current = null;
        break;

      case "error":
        flushTextBuffer();
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              text: lastContentRef.current,
              blocks: [...m.blocks, { type: "error", error: chunk.error }],
              isStreaming: false,
            };
          })
        );
        setIsStreaming(false);
        setCurrentAgentPhase("出错了");
        setExecutionSteps((prev) =>
          prev.map((s) => (s.status === "active" ? { ...s, status: "error", error: chunk.error } : s))
        );
        currentMessageRef.current = null;
        break;
    }
  };

  useEffect(() => {
    if (!projectId) return;
    connect();
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [projectId]);

  const sendMessage = useCallback(
    (text: string, chapterId?: string, selectedText?: string, action?: string) => {
      if (!projectId) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.error("WebSocket not connected");
        return;
      }

      lastContentRef.current = "";
      textBufferRef.current = "";
      setExecutionSteps([]);
      setCurrentAgentPhase("正在思考...");

      addStep("agent", "决策Agent", "分析用户请求");

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text,
        blocks: [],
        timestamp: Date.now(),
        isStreaming: false,
      };

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "",
        blocks: [],
        timestamp: Date.now(),
        isStreaming: true,
      };

      currentMessageRef.current = assistantMsg.id;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      wsRef.current.send(JSON.stringify({
        event: "chat",
        text,
        projectId,
        chapterId: chapterId || "",
        selectedText: selectedText || "",
        action: action || "",
      }));
    },
    [projectId, addStep]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    currentMessageRef.current = null;
    setIsStreaming(false);
    setCurrentAgentPhase("");
    setExecutionSteps([]);
    lastContentRef.current = "";
    textBufferRef.current = "";
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
  }, [flushTextBuffer]);

  const getLastGeneratedContent = useCallback(() => {
    return lastContentRef.current;
  }, []);

  return {
    messages,
    isStreaming,
    connected,
    sendMessage,
    clearMessages,
    currentAgentPhase,
    getLastGeneratedContent,
    executionSteps,
    connect,
    disconnect,
  };
}

export type { ExecutionStep };