import { useState, useCallback, useRef, useEffect } from "react";
import type { Project, Chapter, AIInsertion } from "./types";
import { ProjectList } from "./components/Project/ProjectList";
import { NovelEditor } from "./components/Editor/NovelEditor";
import { ChatPanel } from "./components/Chat/ChatPanel";
import { CharacterBoard } from "./components/CharacterBoard/CharacterBoard";
import { useNovelAgent } from "./hooks/useNovelAgent";
import { useTheme } from "./hooks/useTheme";
import { BookOpen, Users, PanelLeftClose, PanelLeft, Sun, Moon } from "lucide-react";
import { chaptersApi } from "./api/chapters";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

type View = "editor" | "characters";

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [view, setView] = useState<View>("editor");
  const [chatOpen, setChatOpen] = useState(true);
  const [pendingInsertion, setPendingInsertion] = useState<{ text: string; agentName: string } | null>(null);
  const [appliedInsertions, setAppliedInsertions] = useState<AIInsertion[]>([]);
  const editorInsertFnRef = useRef<((text: string, agentName: string) => void) | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<string | null>(null);

  const { theme, toggle: toggleTheme } = useTheme();

  const {
    messages,
    isStreaming,
    connected,
    sendMessage,
    clearMessages,
    currentAgentPhase,
    getLastGeneratedContent,
    executionSteps,
  } = useNovelAgent({ projectId: project?.id });

  const handleSelectProject = useCallback((p: Project) => {
    setProject(p);
    setActiveChapterId(null);
    setChapters([]);
    clearMessages();
    setPendingInsertion(null);
    setAppliedInsertions([]);
  }, [clearMessages]);

  const loadedProjectRef = useRef<string | null>(null);

  useEffect(() => {
    if (!project?.id) return;
    if (loadedProjectRef.current === project.id) return;
    loadedProjectRef.current = project.id;

    chaptersApi.list(project.id).then((chapterList) => {
      setChapters(chapterList);
      if (chapterList.length > 0) {
        setActiveChapterId(chapterList[0].id);
      }
    }).catch((err) => {
      console.error("Failed to load chapters:", err);
    });
  }, [project?.id]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleBackToProjects = () => {
    setProject(null);
    setActiveChapterId(null);
    setChapters([]);
    clearMessages();
    setPendingInsertion(null);
    setAppliedInsertions([]);
  };

  const handleChapterSelect = (id: string) => {
    setActiveChapterId(id);
  };

  const handleContentChange = useCallback((content: string) => {
    if (!activeChapterId) return;
    setChapters((prev) =>
      prev.map((c) => (c.id === activeChapterId ? { ...c, content } : c))
    );
    pendingContentRef.current = content;

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(async () => {
      if (!activeChapterId || !pendingContentRef.current) return;
      try {
        await fetch(`/api/v1/chapters/${activeChapterId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: pendingContentRef.current }),
        });
      } catch (err) {
        console.error("Failed to save chapter:", err);
      }
    }, 800);
  }, [activeChapterId]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleTextSelect = (text: string) => {
    setSelectedText(text);
  };

  const handleInsertTextCallback = useCallback((fn: (text: string, agentName: string) => void) => {
    editorInsertFnRef.current = fn;
  }, []);

  const handleInsertionApplied = useCallback((insertion: AIInsertion) => {
    setAppliedInsertions((prev) => [...prev, insertion]);
    setPendingInsertion(null);
  }, []);

  const handleAcceptContent = useCallback((content: string, agentName: string = "AI") => {
    setPendingInsertion({ text: content, agentName });
  }, []);

  const handleInsertToEditor = useCallback(() => {
    const insertFn = editorInsertFnRef.current;
    const content = getLastGeneratedContent();
    if (insertFn && content) {
      insertFn(content, "AI创作");
    }
  }, [getLastGeneratedContent]);

  const handleClearGenerated = useCallback(() => {
    setPendingInsertion(null);
  }, []);

  if (!project) {
    return <ProjectList onSelect={handleSelectProject} />;
  }

  const activeChapter = chapters.find((c) => c.id === activeChapterId);

  const navButtonClasses = (active: boolean) =>
    `flex-1 flex items-center justify-center gap-1 px-2 py-2 text-xs rounded-md transition-colors ${
      active ? "bg-brand-600/20 text-brand-600 dark:text-brand-400" : "text-content-muted hover:text-content-primary hover:bg-surface-hover"
    }`;

  return (
    <div className="flex h-full bg-surface-base text-content-primary">
      <aside className={`${sidebarOpen ? "w-56" : "w-0"} lg:w-56 bg-surface-DEFAULT border-r border-border flex flex-col overflow-hidden transition-all duration-200`}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleBackToProjects}
              className="text-xs text-content-muted hover:text-content-primary transition-colors"
            >
              ← 返回
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md hover:bg-surface-hover text-content-muted hover:text-content-primary transition-colors"
                title={theme === "dark" ? "切换到浅色模式" : "切换到暗色模式"}
              >
                {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-1.5 rounded-md hover:bg-surface-hover text-content-muted"
              >
                <PanelLeftClose size={14} />
              </button>
            </div>
          </div>
          <h2 className="text-base font-bold truncate">{project.title}</h2>
          {project.style && (
            <span className="text-xs text-brand-600 dark:text-brand-400">{project.style}</span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {chapters.length === 0 ? (
            <div className="text-xs text-content-muted text-center py-8">
              暂无章节
            </div>
          ) : (
            chapters.map((ch) => (
              <button
                key={ch.id}
                onClick={() => { handleChapterSelect(ch.id); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm mb-0.5 truncate transition-colors ${
                  ch.id === activeChapterId
                    ? "bg-brand-600/20 text-brand-600 dark:text-brand-400"
                    : "text-content-secondary hover:bg-surface-hover hover:text-content-primary"
                }`}
              >
                <span className="text-xs text-content-muted mr-1">第{ch.sort_order}章</span>
                {ch.title}
              </button>
            ))
          )}
        </nav>

        <div className="border-t border-border p-2 flex gap-1">
          <button onClick={() => setView("editor")} className={navButtonClasses(view === "editor")}>
            <BookOpen size={14} />
            <span className="hidden sm:inline">编辑</span>
          </button>
          <button onClick={() => setView("characters")} className={navButtonClasses(view === "characters")}>
            <Users size={14} />
            <span className="hidden sm:inline">人物</span>
          </button>
          <button onClick={() => setChatOpen(!chatOpen)} className={navButtonClasses(chatOpen)}>
            {chatOpen ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
            <span className="hidden sm:inline">AI</span>
          </button>
        </div>
      </aside>

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden fixed left-0 top-1/2 -translate-y-1/2 z-10 p-1 bg-surface-elevated border border-border rounded-r-md text-content-muted hover:text-content-primary shadow-md"
        >
          <PanelLeft size={16} />
        </button>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <ErrorBoundary>
          {view === "editor" && activeChapter ? (
            <NovelEditor
              chapter={activeChapter}
              onContentChange={handleContentChange}
              onTextSelect={handleTextSelect}
              insertTextCallback={handleInsertTextCallback}
              onInsertionApplied={handleInsertionApplied}
              pendingInsertion={pendingInsertion}
            />
          ) : view === "characters" ? (
            <CharacterBoard projectId={project.id} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-content-muted">
              选择一个章节开始编辑
            </div>
          )}
        </ErrorBoundary>
      </main>

      {chatOpen && (
        <aside className="w-80 xl:w-96 bg-surface-DEFAULT border-l border-border flex flex-col">
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            connected={connected}
            selectedText={selectedText}
            projectId={project.id}
            chapterId={activeChapterId}
            onSend={sendMessage}
            currentAgentPhase={currentAgentPhase}
            executionSteps={executionSteps}
            lastGeneratedContent={getLastGeneratedContent()}
            onAcceptContent={handleAcceptContent}
            onInsertToEditor={handleInsertToEditor}
            onClearGenerated={handleClearGenerated}
          />
        </aside>
      )}
    </div>
  );
}

export default App;
