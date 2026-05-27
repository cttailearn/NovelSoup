import { request } from './client';
import type { Memory } from '../types';

export const memoriesApi = {
  list: (projectId: string) =>
    request<Memory[]>(`/v1/memories/project/${projectId}`),

  create: (data: { isolation_key: string; type: string; content: string; role?: string; name?: string; chapter_id?: string }) =>
    request<Memory>('/v1/memories/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/v1/memories/${id}`, {
      method: 'DELETE',
    }),

  clear: (projectId: string) =>
    request<{ success: boolean; deleted: number }>(`/v1/memories/clear/${projectId}`, {
      method: 'POST',
    }),
};