import type { Env } from '../types';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ProviderMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderChatRequest {
  model: string;
  messages: ProviderMessage[];
  signal: AbortSignal;
}

/**
 * Contract every AI provider adapter implements. Business logic never talks to
 * a vendor API directly — it only consumes normalized text deltas.
 */
export interface AIProvider {
  readonly id: string;
  isAvailable(env: Env): boolean;
  /** Yields plain-text deltas. Throws ProviderError on failure. */
  streamChat(env: Env, request: ProviderChatRequest): AsyncGenerator<string, void, unknown>;
}

export class ProviderError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ProviderError';
    this.status = status;
    this.code = code;
  }
}

export function providerErrorForStatus(status: number): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(502, 'PROVIDER_AUTH_ERROR', 'ผู้ให้บริการปฏิเสธการยืนยันตัวตน กรุณาตรวจสอบ API Key');
  }
  if (status === 429) {
    return new ProviderError(429, 'PROVIDER_RATE_LIMITED', 'ผู้ให้บริการจำกัดการใช้งานชั่วคราว กรุณาลองใหม่ภายหลัง');
  }
  if (status === 404) {
    return new ProviderError(502, 'PROVIDER_MODEL_UNAVAILABLE', 'ไม่พบโมเดลที่เลือกในบัญชีผู้ให้บริการ');
  }
  if (status >= 500) {
    return new ProviderError(502, 'PROVIDER_UNAVAILABLE', 'ผู้ให้บริการไม่พร้อมใช้งานชั่วคราว');
  }
  return new ProviderError(502, 'PROVIDER_BAD_REQUEST', 'ผู้ให้บริการปฏิเสธคำขอ (ตรวจสอบโมเดลและรูปแบบข้อความ)');
}

export function resolveBaseUrl(raw: string | undefined, fallback: string): URL {
  const value = raw?.trim() || fallback;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ProviderError(500, 'PROVIDER_MISCONFIGURED', 'การตั้งค่า Base URL ของผู้ให้บริการไม่ถูกต้อง');
  }
  if (url.protocol !== 'https:') {
    throw new ProviderError(500, 'PROVIDER_MISCONFIGURED', 'Base URL ของผู้ให้บริการต้องใช้ HTTPS');
  }
  return url;
}
