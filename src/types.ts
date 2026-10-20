export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface ProviderInfo {
  id: string;
  label: string;
  available: boolean;
  models: ModelInfo[];
}

export interface ModelsResponse {
  providers: ProviderInfo[];
  default: { provider: string; model: string };
}

export interface Conversation {
  id: string;
  title: string;
  provider: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  provider: string | null;
  model: string | null;
  status: 'complete' | 'error' | 'aborted';
  createdAt: number;
  pending?: boolean;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: ChatMessage[];
}

export interface Selection {
  provider: string;
  model: string;
}
