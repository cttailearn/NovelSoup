import { useState, useCallback, useMemo } from "react";
import type { ChapterParseRule, ParsedChapter } from "../types";
import { DEFAULT_PARSE_RULES } from "../types";

export function useChapterParser() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rules, setRules] = useState<ChapterParseRule[]>(DEFAULT_PARSE_RULES);
  const [parsedChapters, setParsedChapters] = useState<ParsedChapter[]>([]);

  const parseChapters = useCallback(() => {
    if (!content) return;

    setLoading(true);
    setError("");

    try {
      const enabledRules = rules.filter((r) => r.enabled);
      const lines = content.split("\n");
      const chapters: ParsedChapter[] = [];
      let currentChapter = { title: "序幕", content: "", startLine: 1 };
      let sortOrder = 1;
      let inChapter = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let matched = false;

        for (const rule of enabledRules) {
          try {
            const regex = new RegExp(rule.pattern, "i");
            const match = line.match(regex);
            if (match) {
              if (inChapter && currentChapter.content.trim()) {
                chapters.push({
                  title: currentChapter.title,
                  content: currentChapter.content.trim(),
                  sort_order: sortOrder,
                  matchedPattern: rule.name,
                });
                sortOrder++;
              }

              currentChapter = {
                title: match[1] || line.trim(),
                content: "",
                startLine: i + 1,
              };
              inChapter = true;
              matched = true;
              break;
            }
          } catch {
            continue;
          }
        }

        if (inChapter && !matched) {
          currentChapter.content += line + "\n";
        }
      }

      if (currentChapter.content.trim()) {
        chapters.push({
          title: currentChapter.title,
          content: currentChapter.content.trim(),
          sort_order: sortOrder,
          matchedPattern: "默认",
        });
      }

      if (chapters.length === 0) {
        chapters.push({
          title: "全文",
          content: content.trim(),
          sort_order: 1,
          matchedPattern: "未匹配规则",
        });
      }

      setParsedChapters(chapters);
    } catch (err: any) {
      setError("解析失败: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [content, rules]);

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  }, []);

  const updateChapterTitle = useCallback((index: number, newTitle: string) => {
    setParsedChapters((prev) => prev.map((c, i) => (i === index ? { ...c, title: newTitle } : c)));
  }, []);

  const removeChapter = useCallback((index: number) => {
    setParsedChapters((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const reset = useCallback(() => {
    setContent("");
    setParsedChapters([]);
    setError("");
  }, []);

  return {
    content,
    setContent,
    loading,
    setLoading,
    error,
    setError,
    rules,
    parsedChapters,
    parseChapters,
    toggleRule,
    updateChapterTitle,
    removeChapter,
    reset,
  };
}
