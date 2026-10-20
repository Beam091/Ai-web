import type {
  ChatMessage,
  Conversation,
  ConversationDetail,
  ModelsResponse,
  Selection,
  User,
} from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'คำขอล้มเหลว',
    );
  } catch {
    return new ApiError(response.status, 'REQUEST_FAILED', `คำขอล้มเหลว (${response.status})`);
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function getMe(): Promise<User | null> {
  try {
    const data = await apiFetch<{ user: User }>('/api/auth/me');
    return data.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export function login(email: string, password: string): Promise<{ user: User }> {
  return apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function register(email: string, password: string): Promise<{ user: User }> {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

export function getModels(): Promise<ModelsResponse> {
  return apiFetch('/api/models');
}

export async function listConversations(): Promise<Conversation[]> {
  const data = await apiFetch<{ conversations: Conversation[] }>('/api/conversations');
  return data.conversations;
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return apiFetch(`/api/conversations/${encodeURIComponent(id)}`);
}

export function renameConversation(id: string, title: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface StreamMeta {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  provider: string;
  model: string;
  title: string;
}

export interface StreamHandlers {
  onMeta?: (meta: StreamMeta) => void;
  onDelta: (text: string) => void;
  onDone?: (payload: { assistantMessageId: string; conversationId: string }) => void;
  onError?: (error: { code: string; message: string }) => void;
}

export async function streamChat(
  input: { conversationId: string | null; content: string; selection: Selection },
  handlers: StreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId: input.conversationId,
      content: input.content,
      provider: input.selection.provider,
      model: input.selection.model,
    }),
    signal,
  });

  if (!response.ok) throw await parseError(response);
  if (!response.body) throw new ApiError(500, 'NO_STREAM', 'เซิร์ฟเวอร์ไม่ได้ส่งข้อมูลกลับมา');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleBlock = (block: string) => {
    let event = 'message';
    const dataLines: string[] = [];
    for (const rawLine of block.split('\n')) {
      const line = rawLine.replace(/\r$/, '');
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length === 0) return;
    let payload: unknown;
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }
    if (event === 'meta') handlers.onMeta?.(payload as StreamMeta);
    else if (event === 'delta') handlers.onDelta((payload as { text: string }).text);
    else if (event === 'done') handlers.onDone?.(payload as { assistantMessageId: string; conversationId: string });
    else if (event === 'error') handlers.onError?.(payload as { code: string; message: string });
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index = buffer.indexOf('\n\n');
      while (index !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        handleBlock(block);
        index = buffer.indexOf('\n\n');
      }
    }
    if (buffer.trim()) handleBlock(buffer);
  } finally {
    reader.releaseLock();
  }
}

export type { ChatMessage };
