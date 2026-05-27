import { request } from './client';
import type { Project } from '../types';

export const projectsApi = {
  list: () => request<Project[]>('/v1/projects/'),

  create: (data: { title: string; author?: string; description?: string; style?: string }) =>
    request<Project>('/v1/projects/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<Project>(`/v1/projects/${id}`),

  update: (id: string, data: Partial<{ title: string; author: string; description: string; style: string }>) =>
    request<Project>(`/v1/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/v1/projects/${id}`, {
      method: 'DELETE',
    }),
};