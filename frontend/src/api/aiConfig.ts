import { request } from './client';

export interface AIConfig {
  id: string;
  name: string;
  category?: string;
  api_key?: string;
  base_url?: string;
  model?: string;
  temperature?: string;
  max_tokens?: number;
  is_active: boolean;
  is_system: boolean;
  create_time: number;
  update_time: number;
}

export interface AgentPrompt {
  id: string;
  name: string;
  agent_type?: string;
  prompt_type?: string;
  content: string;
  description?: string;
  is_active: boolean;
  is_system: boolean;
  create_time: number;
  update_time: number;
}

export interface ExtractField {
  field: string;
  label: string;
  type?: string;
  required: boolean;
  description: string;
  enabled?: boolean;
}

export interface ExtractRecord {
  id: string;
  chapter_ids: string;
  extracted_count: number;
  merged_count: number;
  status: string;
  create_time: number;
}

export interface ExtractConfig {
  fields: ExtractField[];
}

export interface ExtractResult {
  success: boolean;
  extracted_count: number;
  merged_count: number;
  characters: any[];
  progress?: number;
}

export const aiConfigApi = {
  list: () => request<AIConfig[]>('/v1/ai-config/'),

  getDefaults: () =>
    request<{
      api_key: string;
      base_url: string;
      model: string;
      temperature: string;
      max_tokens: number;
    }>('/v1/ai-config/defaults'),

  testConnection: (data: { api_key: string; base_url: string; model: string }) =>
    request<{ success: boolean; message?: string; error?: string }>('/v1/ai-config/test-connection', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  importFromEnv: () =>
    request<{ success: boolean; config?: AIConfig; error?: string }>('/v1/ai-config/import-from-env', {
      method: 'POST',
    }),

  create: (data: Partial<AIConfig>) =>
    request<AIConfig>('/v1/ai-config/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<AIConfig>(`/v1/ai-config/${id}`),

  update: (id: string, data: Partial<AIConfig>) =>
    request<AIConfig>(`/v1/ai-config/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/v1/ai-config/${id}`, {
      method: 'DELETE',
    }),

  activate: (id: string) =>
    request<{ success: boolean }>(`/v1/ai-config/activate/${id}`, {
      method: 'POST',
    }),
};

export const promptsApi = {
  list: () => request<AgentPrompt[]>('/v1/prompts/'),

  getSystemPrompts: () =>
    request<{ prompts: Record<string, { name: string; content: string; description: string }>}>('/v1/prompts/system-prompts'),

  initSystemPrompts: () =>
    request<{ success: boolean; created: number }>('/v1/prompts/init-prompts', {
      method: 'POST',
    }),

  listByType: (agentType: string) => request<AgentPrompt[]>(`/v1/prompts/by-type/${agentType}`),

  create: (data: Partial<AgentPrompt>) =>
    request<AgentPrompt>('/v1/prompts/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<AgentPrompt>(`/v1/prompts/${id}`),

  update: (id: string, data: Partial<AgentPrompt>) =>
    request<AgentPrompt>(`/v1/prompts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/v1/prompts/${id}`, {
      method: 'DELETE',
    }),

  activate: (id: string) =>
    request<{ success: boolean }>(`/v1/prompts/activate/${id}`, {
      method: 'POST',
    }),
};

export const characterExtractApi = {
  extract: (projectId: string, chapterIds: string) =>
    request<ExtractResult>(`/v1/character-extract/${projectId}`, {
      method: 'POST',
      body: JSON.stringify({ chapter_ids: chapterIds }),
    }),

  getConfig: (projectId: string) =>
    request<ExtractConfig>(`/v1/character-extract/config/${projectId}`),

  updateConfig: (projectId: string, fields: ExtractField[]) =>
    request<{ success: boolean }>(`/v1/character-extract/config/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ fields }),
    }),

  getRecords: (projectId: string) =>
    request<ExtractRecord[]>(`/v1/character-extract/records/${projectId}`),

  getAvailableFields: () =>
    request<{ fields: ExtractField[] }>(`/v1/character-extract/available-fields`),
};