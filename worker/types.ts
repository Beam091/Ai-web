/// <reference types="@cloudflare/workers-types" />

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  APP_ENV?: string;
  SIGNUP_CODE?: string;

  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_BASE_URL?: string;
  EXTRA_OPENAI_MODELS?: string;
  EXTRA_GEMINI_MODELS?: string;
  DEFAULT_PROVIDER?: string;

  CHAT_RATE_LIMIT?: string;
  CHAT_RATE_WINDOW_MINUTES?: string;
  LOGIN_RATE_LIMIT?: string;
  LOGIN_RATE_WINDOW_MINUTES?: string;
  AI_TIMEOUT_SECONDS?: string;
  AI_MAX_OUTPUT_CHARS?: string;
  /** Mock provider only: delay between tokens for demos and timeout tests. */
  MOCK_DELAY_MS?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: SessionUser;
    sessionHash: string;
    requestId: string;
  };
};
