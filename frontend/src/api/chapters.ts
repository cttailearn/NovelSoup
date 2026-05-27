import { request } from './client';
import type { Chapter } from '../types';

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
};