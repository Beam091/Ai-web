import type { Env } from '../types';

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

interface ProviderCatalogEntry {
  id: string;
  label: string;
  models: ModelInfo[];
  configured: (env: Env) => boolean;
  extraModels: (env: Env) => string[] | undefined;
}

/**
 * Server-side allowlist. A client can only request (provider, model) pairs
 * listed here. Model ids are verified against provider docs at design time but
 * MUST be re-checked against the account before production use — availability
 * differs per account and region.
 */
export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'mock',
    label: 'Mock (Demo)',
    models: [{ id: 'mock-echo', label: 'Mock Echo — ทดสอบ UI ไม่เรียก AI จริง' }],
    configured: () => true,
    extraModels: () => undefined,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    models: [
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
    ],
    configured: (env) => Boolean(env.OPENAI_API_KEY),
    extraModels: (env) => splitList(env.EXTRA_OPENAI_MODELS),
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    ],
    configured: (env) => Boolean(env.GEMINI_API_KEY),
    extraModels: (env) => splitList(env.EXTRA_GEMINI_MODELS),
  },
];

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 120);
}

export function listProviders(env: Env): ProviderInfo[] {
  return PROVIDER_CATALOG.map((entry) => {
    const extras = entry.extraModels(env) ?? [];
    const seen = new Set(entry.models.map((model) => model.id));
    const models = [...entry.models];
    for (const id of extras) {
      if (!seen.has(id)) {
        seen.add(id);
        models.push({ id, label: id });
      }
    }
    return {
      id: entry.id,
      label: entry.label,
      available: entry.configured(env),
      models,
    };
  });
}

export function resolveModel(env: Env, providerId: string, modelId: string): ModelInfo | null {
  const provider = listProviders(env).find((item) => item.id === providerId);
  if (!provider || !provider.available) return null;
  return provider.models.find((model) => model.id === modelId) ?? null;
}

export function defaultSelection(env: Env): { provider: string; model: string } {
  const providers = listProviders(env);
  const preferred = providers.find(
    (item) => item.id === (env.DEFAULT_PROVIDER ?? '') && item.available && item.models.length > 0,
  );
  const fallback = providers.find((item) => item.available && item.models.length > 0);
  const chosen = preferred ?? fallback ?? providers[0];
  return { provider: chosen.id, model: chosen.models[0]?.id ?? 'mock-echo' };
}
