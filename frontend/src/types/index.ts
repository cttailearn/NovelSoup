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
  editable?: boolean;
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
    name: "第X章（中文）",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+章)\\s*",
    example: "第1章 开始的序幕",
    enabled: true,
  },
  {
    id: "2",
    name: "第X回（古风）",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+回)\\s*",
    example: "第一回 梦开始的地方",
    enabled: true,
  },
  {
    id: "3",
    name: "Chapter X（英文）",
    pattern: "^(Chapter\\s+\\d+)\\s*[:\\.\\-]?",
    example: "Chapter 1: Introduction",
    enabled: true,
  },
  {
    id: "4",
    name: "Chapter X 英文序数词",
    pattern: "^(Chapter\\s+[A-Za-z]+\\s+\\d+)\\s*[:\\.\\-]?",
    example: "Chapter One 开始的序幕",
    enabled: false,
  },
  {
    id: "5",
    name: "卷X-章节（卷册）",
    pattern: "^(卷[一二三四五六七八九十百千零\\d]+[-－]\\s*[第篇部][^\\n]+)\\s*",
    example: "卷一-第一章 序幕",
    enabled: false,
  },
  {
    id: "6",
    name: "XX_XX（下划线）",
    pattern: "^([A-Z][A-Za-z\\s]+[_－][^\\n]+)\\s*",
    example: "Chapter_1_The_Beginning",
    enabled: false,
  },
  {
    id: "7",
    name: "第X节",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+节)\\s*",
    example: "第一节 序章",
    enabled: false,
  },
  {
    id: "8",
    name: "X.X.（数字编号）",
    pattern: "^(\\d+\\.\\d+[\\.\\s].*)$",
    example: "1.1 开篇",
    enabled: false,
  },
  {
    id: "9",
    name: "X-（短横线）",
    pattern: "^(\\d+[-－][^\\n]+)\\s*",
    example: "1-第一章 开篇",
    enabled: false,
  },
  {
    id: "10",
    name: "【X】",
    pattern: "^【([^】]+)】\\s*",
    example: "【第一章】开篇",
    enabled: false,
  },
  {
    id: "11",
    name: "（X）括号章节",
    pattern: "^（([一二三四五六七八九十百千零\\d]+)）\\s*",
    example: "（第一章）开篇",
    enabled: false,
  },
  {
    id: "12",
    name: "第一部分",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+[部分篇部])",
    example: "第一部分 序幕",
    enabled: false,
  },
];

export const PRESET_PARSE_RULES: ChapterParseRule[] = [
  {
    id: "p1",
    name: "网文小说",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+章)[\\s\\S]*?$",
    example: "第1章 逆天改命",
    enabled: true,
  },
  {
    id: "p2",
    name: "传统文学",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+回)\\s*",
    example: "第一回 梦开始的地方",
    enabled: true,
  },
  {
    id: "p3",
    name: "英文小说",
    pattern: "^(Chapter\\s+\\d+)[:\\.\\-]?\\s*",
    example: "Chapter 1: The Beginning",
    enabled: true,
  },
  {
    id: "p4",
    name: "轻小说",
    pattern: "^(Episode\\s+\\d+)",
    example: "Episode 1 新的开始",
    enabled: false,
  },
  {
    id: "p5",
    name: "古籍章回体",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+回)\\s+《?[^》]+》?",
    example: "第一回 石头记",
    enabled: false,
  },
  {
    id: "p6",
    name: "现代文学",
    pattern: "^(\\d+\\.\\s+.+)$",
    example: "1. 黎明的曙光",
    enabled: false,
  },
  {
    id: "p7",
    name: "日文小说",
    pattern: "^(第[一二三四五六七八九十百千零\\d]+幕)\\s*",
    example: "第一幕 序幕",
    enabled: false,
  },
  {
    id: "p8",
    name: "通用章节",
    pattern: "^(.+)$",
    example: "任何以文字开头的行",
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