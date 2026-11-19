import type {
  Agent,
  AgentCategory,
  Conversation,
  Message,
  MessageAttachment,
  Preset,
  PromptItem,
  StartupConfig,
  User,
} from '~/types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  getConfig: () => request<StartupConfig>('/api/config'),
  getUser: () => request<User>('/api/user'),
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  getConversations: (search = '') =>
    request<{ conversations: Conversation[] }>(
      `/api/convos${search ? `?search=${encodeURIComponent(search)}` : ''}`,
    ),
  getConversation: (conversationId: string) =>
    request<{ conversation: Conversation; messages: Message[] }>(
      `/api/convos/${encodeURIComponent(conversationId)}`,
    ),
  updateConversation: (conversationId: string, patch: Partial<Conversation>) =>
    request<{ conversation: Conversation }>(`/api/convos/${encodeURIComponent(conversationId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  deleteConversation: (conversationId: string) =>
    request<{ deleted: boolean }>(`/api/convos/${encodeURIComponent(conversationId)}`, {
      method: 'DELETE',
    }),
  clearConversations: () => request<{ cleared: boolean }>('/api/convos', { method: 'DELETE' }),

  getAgentCategories: () => request<AgentCategory[]>('/api/agents/categories'),
  getAgents: (params: { category?: string; q?: string; mine?: boolean; sort?: string } = {}) => {
    const search = new URLSearchParams();
    if (params.category) search.set('category', params.category);
    if (params.q) search.set('q', params.q);
    if (params.mine) search.set('mine', '1');
    if (params.sort) search.set('sort', params.sort);
    return request<{ data: Agent[] }>(`/api/agents?${search.toString()}`);
  },
  createAgent: (payload: {
    name: string;
    description: string;
    instructions: string;
    category: string;
    provider: string;
    model: string;
    starters?: string[];
  }) =>
    request<{ agent: Agent }>('/api/agents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAgent: (id: string) =>
    request<{ deleted: boolean }>(`/api/agents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getPrompts: (q = '') =>
    request<{ prompts: PromptItem[] }>(`/api/prompts${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  createPrompt: (payload: {
    title: string;
    oneliner: string;
    prompt: string;
    category: string;
    command: string;
  }) =>
    request<{ prompt: PromptItem }>('/api/prompts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePrompt: (id: string) =>
    request<{ deleted: boolean }>(`/api/prompts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getPresets: () => request<{ presets: Preset[] }>('/api/presets'),
  createPreset: (payload: {
    title: string;
    endpoint: string;
    model: string;
    systemPrompt?: string;
    temperature?: number;
    topP?: number;
  }) =>
    request<{ preset: Preset }>('/api/presets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deletePreset: (presetId: string) =>
    request<{ deleted: boolean }>(`/api/presets/${encodeURIComponent(presetId)}`, {
      method: 'DELETE',
    }),
};

export type ChatStreamPayload = {
  conversationId?: string;
  text: string;
  endpoint: string;
  model: string;
  agentId?: string;
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  attachments?: MessageAttachment[];
  regenerateFromMessageId?: string;
  editedMessageId?: string;
};

export type ChatStreamCallbacks = {
  signal?: AbortSignal;
  onMeta?: (data: {
    conversation: Conversation;
    userMessage: Message | null;
    assistantMessageId: string;
  }) => void;
  onDelta?: (text: string) => void;
  onDone?: (data: { conversation: Conversation; assistantMessage: Message }) => void;
};

export async function streamChat(payload: ChatStreamPayload, callbacks: ChatStreamCallbacks) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: callbacks.signal,
  });

  if (!res.ok || !res.body) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.error || `Chat request failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const chunk of events) {
      const line = chunk
        .split('\n')
        .find((l) => l.startsWith('data:'))
        ?.slice(5)
        .trim();
      if (!line) {
        continue;
      }
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === 'meta') {
          callbacks.onMeta?.(parsed);
        } else if (parsed.type === 'delta') {
          callbacks.onDelta?.(parsed.text ?? '');
        } else if (parsed.type === 'done') {
          callbacks.onDone?.(parsed);
        }
      } catch {
        // Ignore malformed SSE fragment
      }
    }
  }
}
