import { request } from './client';
import type { Chapter, ChapterParseRule } from '../types';

export const chaptersApi = {
  list: (projectId: string) =>
    request<Chapter[]>(`/v1/chapters/project/${projectId}`),

  create: (data: { project_id: string; title: string; content?: string; sort_order?: number }) =>
    request<Chapter>('/v1/chapters/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<Chapter>(`/v1/chapters/${id}`),

  update: (id: string, data: Partial<{ title: string; content: string; sort_order: number }>) =>
    request<Chapter>(`/v1/chapters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/v1/chapters/${id}`, {
      method: 'DELETE',
    }),

  getRules: (projectId: string) =>
    request<{ rules: ChapterParseRule[] }>(`/v1/chapters/rules/${projectId}`),

  saveRules: (projectId: string, rules: ChapterParseRule[]) =>
    request<{ success: boolean }>(`/v1/chapters/rules/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ rules }),
    }),

  reparse: (projectId: string, content: string) =>
    request<{
      chapters: { title: string; content: string; word_count: number }[];
      rules: { pattern: string; name: string; enabled: boolean }[];
    }>(`/v1/chapters/reparse/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),
};