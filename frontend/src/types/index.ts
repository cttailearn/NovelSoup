export interface Project {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  style: string | null;
  create_time: number;
  update_time: number;
}

export interface ProjectCreate {
  title: string;
  author?: string | null;
  description?: string | null;
  style?: string | null;
}

export interface ProjectUpdate {
  title?: string;
  author?: string | null;
  description?: string | null;
  style?: string | null;
}

export interface Chapter {
  id: string;
  project_id: string;
  title: string;
  content: string;
  sort_order: number;
  word_count: number | null;
  summary: string | null;
  create_time: number;
  update_time: number;
}

export interface ChapterCreate {
  project_id: string;
  title: string;
  content?: string;
  sort_order?: number;
  word_count?: number | null;
  summary?: string | null;
}

export interface ChapterUpdate {
  title?: string;
  content?: string;
  sort_order?: number;
  word_count?: number | null;
  summary?: string | null;
}

export interface Character {
  id: string;
  project_id: string;
  name: string;
  aliases: string | string[];
  description: string | null;
  traits: string | Record<string, string>;
  relations: string | Record<string, string>;
  status: string;
  create_time: number;
  update_time: number;
}

export interface CharacterCreate {
  project_id: string;
  name: string;
  aliases?: string[];
  description?: string | null;
  traits?: Record<string, string>;
  relations?: Record<string, string>;
}

export interface CharacterUpdate {
  name?: string;
  aliases?: string[];
  description?: string | null;
  traits?: Record<string, string>;
  relations?: Record<string, string>;
  status?: string;
}

export interface Memory {
  id: string;
  isolation_key: string;
  type: string;
  role?: string | null;
  name?: string | null;
  content: string;
  chapter_id?: string | null;
  embedding?: string | null;
  summarized: boolean;
  create_time: number;
}

export interface MemoryCreate {
  isolation_key: string;
  type: string;
  content: string;
  role?: string;
  name?: string;
  chapter_id?: string;
}

export type MessageBlockType =
  | "text"
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "agent_start"
  | "agent_complete"
  | "review"
  | "content:update"
  | "error"
  | "done";

export interface MessageBlock {
  type: MessageBlockType;
  content?: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: string;
  agentName?: string;
  review?: ReviewResult;
  error?: string;
}

export interface ReviewResult {
  grade: "A" | "B" | "C" | "D";
  summary: string;
  details?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  blocks: MessageBlock[];
  timestamp: number;
  isStreaming: boolean;
}

export interface AIInsertion {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
  agentName: string;
  timestamp: number;
  status: "pending" | "applied" | "discarded";
}

export interface ExecutionStep {
  id: string;
  type: "agent" | "tool";
  name: string;
  description?: string;
  status: "pending" | "active" | "done" | "error";
  error?: string;
}

export interface ChapterParseRule {
  id: string;
  name: string;
  pattern: string;
  example: string;
  enabled: boolean;
}

export interface ParsedChapter {
  title: string;
  content: string;
  sort_order: number;
  matchedPattern: string;
}

export const DEFAULT_PARSE_RULES: ChapterParseRule[] = [
  {
    id: "1",
    name: "第X章",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+章)\\s*",
    example: "第1章 开始的序幕",
    enabled: true,
  },
  {
    id: "2",
    name: "第X回",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+回)\\s*",
    example: "第一回 梦开始的地方",
    enabled: true,
  },
  {
    id: "3",
    name: "Chapter X",
    pattern: "^(Chapter\\s+\\d+)\\s*[:\\.\\-]?",
    example: "Chapter 1: Introduction",
    enabled: true,
  },
  {
    id: "4",
    name: "Chapter X (英)",
    pattern: "^(Chapter\\s+[A-Za-z]+\\s+\\d+)\\s*[:\\.\\-]?",
    example: "Chapter One 开始的序幕",
    enabled: false,
  },
  {
    id: "5",
    name: "卷X-章节",
    pattern: "^(卷[一二三四五六七八九十百千零\\d]+[-－]\\s*[第篇部][^\\n]+)\\s*",
    example: "卷一-第一章 序幕",
    enabled: false,
  },
  {
    id: "6",
    name: "XX_XX (下划线)",
    pattern: "^([A-Z][A-Za-z\\s]+[_－][^\\n]+)\\s*",
    example: "Chapter_1_The_Beginning",
    enabled: false,
  },
];

export function toCamelCase<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = obj[key];
  }
  return result as T;
}

export function toSnakeCase<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = obj[key];
  }
  return result as T;
}