import type { Env } from '../types';
import type { AIProvider } from './types';
import { GeminiProvider } from './gemini';
import { MockProvider } from './mock';
import { OpenAIProvider } from './openai';

const providers: AIProvider[] = [new GeminiProvider(), new MockProvider(), new OpenAIProvider()];

const registry = new Map(providers.map((provider) => [provider.id, provider]));

export function getProvider(id: string): AIProvider | undefined {
  return registry.get(id);
}

export function isProviderAvailable(env: Env, id: string): boolean {
  return getProvider(id)?.isAvailable(env) ?? false;
}
