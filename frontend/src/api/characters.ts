import { request } from './client';
import type { Character } from '../types';

export const charactersApi = {
  list: (projectId: string) =>
    request<Character[]>(`/v1/characters/project/${projectId}`),

  create: (data: { project_id: string; name: string; aliases?: string[]; description?: string; traits?: Record<string, string>; relations?: Record<string, string> }) =>
    request<Character>('/v1/characters/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<Character>(`/v1/characters/${id}`),

  update: (id: string, data: Partial<{ name: string; aliases: string[]; description: string; traits: Record<string, string>; relations: Record<string, string>; status: string }>) =>
    request<Character>(`/v1/characters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/v1/characters/${id}`, {
      method: 'DELETE',
    }),
};