import { useRef, useCallback, useEffect, useState } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { Chapter, AIInsertion } from "../../types";
import type { editor } from "monaco-editor";
import { Check, Loader2 } from "lucide-react";

interface Props {
  chapter: Chapter;
  onContentChange: (content: string) => void;
  onTextSelect: (text: string) => void;
  insertTextCallback?: (insertFn: (text: string, agentName: string) => void) => void;
  onInsertionApplied?: (insertion: AIInsertion) => void;
  pendingInsertion?: { text: string; agentName: string } | null;
}

const AI_HIGHLIGHT_CLASS = "ai-insertion";

export function NovelEditor({
  chapter,
  onContentChange,
  onTextSelect,
  insertTextCallback,
  onInsertionApplied,
  pendingInsertion,
}: Props) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const insertionsRef = useRef<AIInsertion[]>([]);
  const [appliedInsertions, setAppliedInsertions] = useState<AIInsertion[]>([]);
  const monacoRef = useRef<any>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = () => document.documentElement.classList.contains("dark");

  const defineThemes = useCallback((monaco: any) => {
    monaco.editor.defineTheme("novel-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#ffffff",
      },
    });

    monaco.editor.defineTheme("novel-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#0f172a",
      },
    });
  }, []);

  const highlightInsertion = useCallback((insertion: AIInsertion) => {
    const currentEditor = editorRef.current;
    if (!currentEditor || !monacoRef.current) return;

    const model = currentEditor.getModel();
    if (!model) return;

    const startPos = model.getPositionAt(insertion.startOffset);
    const endPos = model.getPositionAt(insertion.endOffset);

    const newDecorations = currentEditor.deltaDecorations(
      decorationsRef.current,
      [
        {
          range: new monacoRef.current.Range(
            startPos.lineNumber,
            startPos.column,
            endPos.lineNumber,
            endPos.column
          ),
          options: {
            className: AI_HIGHLIGHT_CLASS,
            hoverMessage: { value: `**AI ${insertion.agentName}**\n点击移除` },
            overviewRuler: {
              color: "#7c3aed",
              position: monacoRef.current.editor.OverviewRulerLane.Right,
            },
            stickiness: monacoRef.current.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          },
        },
      ]
    );

    decorationsRef.current = newDecorations;

    currentEditor.onMouseDown((e) => {
      if (e.target.type === monacoRef.current.editor.MouseTargetType.TEXT_NEAR_SELECTION) {
        const range = e.target.position;
        if (range) {
          const offset = model.getOffsetAt(range);
          const insertion = insertionsRef.current.find(
            (i) => offset >= i.startOffset && offset <= i.endOffset
          );
          if (insertion) {
            removeInsertion(insertion);
          }
        }
      }
    });
  }, []);

  const removeInsertion = useCallback((insertion: AIInsertion) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return;

    const model = currentEditor.getModel();
    if (!model) return;

    const content = model.getValue();
    const before = content.slice(0, insertion.startOffset);
    const after = content.slice(insertion.endOffset);
    const newContent = before + after;

    model.setValue(newContent);

    const offsetDiff = insertion.endOffset - insertion.startOffset;
    insertionsRef.current = insertionsRef.current
      .filter((i) => i.id !== insertion.id)
      .map((i) => {
        if (i.startOffset > insertion.startOffset) {
          return {
            ...i,
            startOffset: i.startOffset - offsetDiff,
            endOffset: i.endOffset - offsetDiff,
          };
        }
        return i;
      });

    setAppliedInsertions((prev) =>
      prev.map((i) => (i.id === insertion.id ? { ...i, status: "discarded" as const } : i))
    );

    onContentChange(newContent);
  }, [onContentChange]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    defineThemes(monaco);

    const style = document.createElement("style");
    style.textContent = `
      .${AI_HIGHLIGHT_CLASS} {
        background-color: rgba(139, 92, 246, 0.2) !important;
        border-bottom: 2px solid rgba(139, 92, 246, 0.6) !important;
        cursor: pointer !important;
      }
      .${AI_HIGHLIGHT_CLASS}:hover {
        background-color: rgba(139, 92, 246, 0.35) !important;
      }
    `;
    document.head.appendChild(style);

    editor.onDidChangeCursorSelection(() => {
      const selection = editor.getSelection();
      if (!selection) return;
      const text = editor.getModel()?.getValueInRange(selection) || "";
      onTextSelect(text.trim());
    });

    editor.addAction({
      id: "save-chapter",
      label: "保存章节",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        const model = editor.getModel();
        if (model) {
          setSaveStatus("saving");
          onContentChange(model.getValue());
          setTimeout(() => {
            setSaveStatus("saved");
            if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
            saveStatusTimerRef.current = setTimeout(() => setSaveStatus(null), 2000);
          }, 300);
        }
      },
    });

    const updateTheme = () => {
      const theme = isDark() ? "novel-dark" : "novel-light";
      monaco.editor.setTheme(theme);
    };
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    if (insertTextCallback) {
      insertTextCallback((text: string, agentName: string = "AI") => {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;
        const selection = currentEditor.getSelection();

        let insertOffset: number;
        if (selection && !selection.isEmpty()) {
          insertOffset = currentEditor.getModel()?.getOffsetAt(selection.getStartPosition()) || 0;
          currentEditor.executeEdits("ai-insert", [{
            range: selection,
            text: text,
            forceMoveMarkers: true,
          }]);
        } else {
          const model = currentEditor.getModel();
          const lastLine = model?.getLineCount() || 1;
          const lastCol = (model?.getLineLength(lastLine) || 0) + 1;
          const position = { lineNumber: lastLine, column: lastCol };
          insertOffset = model?.getOffsetAt(position) || 0;

          currentEditor.setPosition(position);
          currentEditor.executeEdits("ai-insert", [{
            range: {
              startLineNumber: lastLine,
              startColumn: lastCol,
              endLineNumber: lastLine,
              endColumn: lastCol,
            },
            text: text,
            forceMoveMarkers: true,
          }]);
        }

        currentEditor.focus();

        const content = currentEditor.getValue();
        const insertion: AIInsertion = {
          id: crypto.randomUUID(),
          text,
          startOffset: insertOffset,
          endOffset: insertOffset + text.length,
          agentName,
          timestamp: Date.now(),
          status: "applied",
        };

        insertionsRef.current.push(insertion);
        setAppliedInsertions((prev) => [...prev, insertion]);

        highlightInsertion(insertion);

        if (onInsertionApplied) {
          onInsertionApplied(insertion);
        }

        onContentChange(content);
      });
    }
  };

  useEffect(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor || !chapter.content) return;
    
    const model = currentEditor.getModel();
    if (!model) return;
    
    const currentValue = model.getValue();
    if (currentValue !== chapter.content) {
      currentEditor.setValue(chapter.content);
    }
  }, [chapter.id, chapter.content]);

  useEffect(() => {
    if (pendingInsertion && editorRef.current) {
      const currentEditor = editorRef.current;
      const model = currentEditor.getModel();
      if (!model) return;

      const lastLine = model.getLineCount();
      const lastCol = model.getLineLength(lastLine) + 1;
      const position = { lineNumber: lastLine, column: lastCol };

      const insertOffset = model.getOffsetAt(position);
      currentEditor.setPosition(position);
      currentEditor.executeEdits("ai-insert", [{
        range: {
          startLineNumber: lastLine,
          startColumn: lastCol,
          endLineNumber: lastLine,
          endColumn: lastCol,
        },
        text: "\n" + pendingInsertion.text,
        forceMoveMarkers: true,
      }]);

      const insertion: AIInsertion = {
        id: crypto.randomUUID(),
        text: pendingInsertion.text,
        startOffset: insertOffset,
        endOffset: insertOffset + pendingInsertion.text.length + 1,
        agentName: pendingInsertion.agentName,
        timestamp: Date.now(),
        status: "applied",
      };

      insertionsRef.current.push(insertion);
      setAppliedInsertions((prev) => [...prev, insertion]);
      highlightInsertion(insertion);

      if (onInsertionApplied) {
        onInsertionApplied(insertion);
      }

      onContentChange(currentEditor.getValue());
    }
  }, [pendingInsertion, highlightInsertion, onContentChange, onInsertionApplied]);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onContentChange(value);
      }
    },
    [onContentChange]
  );

  const editorTheme = isDark() ? "novel-dark" : "novel-light";

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between bg-surface-muted flex-shrink-0">
        <div>
          <h3 className="text-sm font-medium text-content-primary">
            第{chapter.sort_order}章 {chapter.title}
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-content-muted">
          {saveStatus === "saving" && (
            <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
              <Loader2 size={12} className="animate-spin" />
              保存中
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="flex items-center gap-1 text-success">
              <Check size={12} />
              已保存
            </span>
          )}
          <span>字数: {chapter.word_count?.toLocaleString() || 0}</span>
          {appliedInsertions.filter((i) => i.status === "applied").length > 0 && (
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">
              {appliedInsertions.filter((i) => i.status === "applied").length} 处AI内容
            </span>
          )}
          <span className="px-2 py-0.5 rounded bg-surface-hover text-content-secondary">
            {chapter.summary ? "已生成摘要" : "未生成摘要"}
          </span>
        </div>
      </div>
      <div className="flex-1">
        <Editor
          key={chapter.id}
          height="100%"
          language="plaintext"
          value={chapter.content}
          onChange={handleChange}
          onMount={handleMount}
          theme={editorTheme}
          options={{
            fontSize: 16,
            lineHeight: 28,
            wordWrap: "on",
            minimap: { enabled: false },
            lineNumbers: "on",
            renderLineHighlight: "line",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 16, bottom: 16 },
            fontFamily: "'Noto Serif SC', 'SimSun', 'STSong', serif",
          }}
          loading={
            <div className="flex items-center justify-center h-full text-content-muted">
              加载编辑器中...
            </div>
          }
        />
      </div>
    </div>
  );
}
