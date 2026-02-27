/**
 * Centralized LLM Configuration
 * 
 * Single source of truth for model selection across the entire app.
 * To switch models: change the env vars or the defaults below.
 * 
 * Supported providers:
 *   - openai     (GPT-5-mini, GPT-4o-mini, etc.)
 *   - deepseek   (DeepSeek R1, etc. - OpenAI-compatible API)
 *   - anthropic  (Claude 3.5/4 - different API format)
 *   - google     (Gemini - different API format)
 */

export type LLMProvider = 'openai' | 'deepseek' | 'anthropic' | 'google';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
}

interface ProviderDefaults {
  baseUrl: string;
  apiKeyEnv: string;
}

const PROVIDER_DEFAULTS: Record<LLMProvider, ProviderDefaults> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyEnv: 'GOOGLE_AI_API_KEY',
  },
};

function resolveProvider(): LLMProvider {
  const env = process.env.LLM_PROVIDER?.toLowerCase();
  if (env && env in PROVIDER_DEFAULTS) return env as LLMProvider;
  return 'openai';
}

function resolveModel(provider: LLMProvider): string {
  if (process.env.LLM_MODEL) return process.env.LLM_MODEL;
  
  const defaults: Record<LLMProvider, string> = {
    openai: 'gpt-5-mini',
    deepseek: 'deepseek-reasoner',
    anthropic: 'claude-sonnet-4-20250514',
    google: 'gemini-2.0-flash',
  };
  return defaults[provider];
}

export function getLLMConfig(overrides?: Partial<Pick<LLMConfig, 'temperature' | 'maxTokens'>>): LLMConfig {
  const provider = resolveProvider();
  const defaults = PROVIDER_DEFAULTS[provider];
  const apiKey = process.env[defaults.apiKeyEnv] || '';
  
  return {
    provider,
    model: resolveModel(provider),
    apiKey,
    baseUrl: process.env.LLM_BASE_URL || defaults.baseUrl,
    maxTokens: overrides?.maxTokens ?? 2500,
    temperature: overrides?.temperature ?? 0.3,
  };
}

export function getAPIKeyForProvider(provider?: LLMProvider): string {
  const p = provider ?? resolveProvider();
  return process.env[PROVIDER_DEFAULTS[p].apiKeyEnv] || '';
}

export function isLLMConfigured(): boolean {
  const config = getLLMConfig();
  return !!config.apiKey;
}

/** Human-friendly model label for UI display (e.g. "GPT-5 Mini", "DeepSeek R1") */
export function getModelDisplayName(): string {
  const model = resolveModel(resolveProvider());

  const displayMap: Record<string, string> = {
    'gpt-5-mini': 'GPT-5 Mini',
    'gpt-5': 'GPT-5',
    'gpt-4o-mini': 'GPT-4o Mini',
    'gpt-4o': 'GPT-4o',
    'o4-mini': 'o4-mini',
    'o3-mini': 'o3-mini',
    'o3': 'o3',
    'o1-mini': 'o1-mini',
    'o1': 'o1',
    'deepseek-reasoner': 'DeepSeek R1',
    'deepseek-chat': 'DeepSeek V3',
    'claude-sonnet-4-20250514': 'Claude Sonnet 4',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'gemini-2.0-flash': 'Gemini 2.0 Flash',
  };

  return displayMap[model] || model;
}
