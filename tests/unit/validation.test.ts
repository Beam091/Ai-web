import { describe, expect, it } from 'vitest';
import { chatSchema, registerSchema, renameSchema, titleFromContent } from '../../worker/lib/validation';
import { defaultSelection, listProviders, resolveModel } from '../../worker/providers/catalog';
import type { Env } from '../../worker/types';

describe('chatSchema', () => {
  it('trims content and accepts a null conversation id', () => {
    const parsed = chatSchema.parse({
      conversationId: null,
      content: '  hello  ',
      provider: 'mock',
      model: 'mock-echo',
    });
    expect(parsed.content).toBe('hello');
  });

  it('rejects empty and oversized content', () => {
    expect(chatSchema.safeParse({ content: '   ', provider: 'mock', model: 'mock-echo' }).success).toBe(false);
    expect(
      chatSchema.safeParse({ content: 'a'.repeat(8001), provider: 'mock', model: 'mock-echo' }).success,
    ).toBe(false);
  });

  it('rejects an invalid conversation id', () => {
    expect(
      chatSchema.safeParse({
        conversationId: 'not-a-uuid',
        content: 'hi',
        provider: 'mock',
        model: 'mock-echo',
      }).success,
    ).toBe(false);
  });
});

describe('registerSchema', () => {
  it('accepts an 8-character password and invite code, and normalizes the invite code', () => {
    const parsed = registerSchema.parse({
      email: ' USER@Example.com ',
      password: '12345678',
      inviteCode: ' abcd2345 ',
    });
    expect(parsed.email).toBe('user@example.com');
    expect(parsed.inviteCode).toBe('ABCD2345');
  });

  it('rejects a password shorter than 8 and an invite code that is not exactly 8 characters', () => {
    expect(registerSchema.safeParse({ email: 'a@b.co', password: '1234567', inviteCode: 'ABCD2345' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.co', password: '12345678', inviteCode: 'ABCD234' }).success).toBe(false);
    expect(registerSchema.safeParse({ email: 'a@b.co', password: '12345678', inviteCode: 'ABCD23456' }).success).toBe(false);
  });
});

describe('renameSchema', () => {
  it('trims titles and rejects blank ones', () => {
    expect(renameSchema.parse({ title: '  แผนงาน  ' }).title).toBe('แผนงาน');
    expect(renameSchema.safeParse({ title: '   ' }).success).toBe(false);
  });
});

describe('titleFromContent', () => {
  it('collapses whitespace and truncates long prompts', () => {
    expect(titleFromContent(' สวัสดี\n\n  โลก ')).toBe('สวัสดี โลก');
    expect(titleFromContent('a'.repeat(100)).endsWith('…')).toBe(true);
  });
});

describe('model catalog', () => {
  const bareEnv = {} as Env;

  it('always exposes the mock provider', () => {
    const providers = listProviders(bareEnv);
    expect(providers.find((provider) => provider.id === 'mock')?.available).toBe(true);
    expect(providers.find((provider) => provider.id === 'openai')?.available).toBe(false);
  });

  it('rejects models that are not allowlisted or not configured', () => {
    expect(resolveModel(bareEnv, 'mock', 'mock-echo')).not.toBeNull();
    expect(resolveModel(bareEnv, 'openai', 'gpt-4.1-mini')).toBeNull();
    expect(resolveModel(bareEnv, 'mock', 'gpt-4.1')).toBeNull();
  });

  it('falls back to mock when the configured default is unavailable', () => {
    expect(defaultSelection(bareEnv)).toEqual({ provider: 'mock', model: 'mock-echo' });
  });

  it('accepts operator-supplied extra models only when the provider is configured', () => {
    const env = {
      OPENAI_API_KEY: 'sk-test',
      EXTRA_OPENAI_MODELS: 'gpt-custom-mini, gpt-custom-mini',
    } as unknown as Env;
    const models = listProviders(env).find((provider) => provider.id === 'openai')?.models ?? [];
    expect(models.filter((model) => model.id === 'gpt-custom-mini')).toHaveLength(1);
    expect(resolveModel(env, 'openai', 'gpt-custom-mini')?.id).toBe('gpt-custom-mini');
  });
});
