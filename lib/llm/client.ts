/**
 * Unified LLM Client
 * 
 * Provides a single interface to call any supported LLM provider.
 * Handles request/response format differences between providers.
 */

import { getLLMConfig, type LLMConfig, type LLMProvider } from './config';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call the configured LLM provider with automatic format handling.
 * 
 * Usage:
 *   const result = await callLLM({
 *     messages: [{ role: 'system', content: '...' }, { role: 'user', content: '...' }],
 *     temperature: 0.7,
 *     maxTokens: 800,
 *   });
 *   console.log(result.content);
 */
export async function callLLM(options: LLMCallOptions): Promise<LLMResponse> {
  const config = getLLMConfig({
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  if (!config.apiKey) {
    throw new Error(`API key not configured for provider "${config.provider}". Set ${getEnvKeyName(config.provider)} environment variable.`);
  }

  switch (config.provider) {
    case 'openai':
    case 'deepseek':
      return callOpenAICompatible(config, options);
    case 'anthropic':
      return callAnthropic(config, options);
    case 'google':
      return callGoogle(config, options);
    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}

function getEnvKeyName(provider: LLMProvider): string {
  const map: Record<LLMProvider, string> = {
    openai: 'OPENAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_AI_API_KEY',
  };
  return map[provider];
}

// ─── OpenAI & DeepSeek (compatible API) ───

/**
 * Reasoning models (gpt-5*, o1*, o3*, o4*) use a different parameter set:
 *   - max_completion_tokens instead of max_tokens
 *   - temperature / top_p NOT supported (must be omitted)
 */
function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[1-4])/.test(model);
}

async function callOpenAICompatible(config: LLMConfig, options: LLMCallOptions): Promise<LLMResponse> {
  const reasoning = isReasoningModel(config.model);
  const requestedTokens = options.maxTokens ?? config.maxTokens;

  const body: any = {
    model: config.model,
    messages: options.messages,
  };

  if (reasoning) {
    // Reasoning models spend tokens on internal chain-of-thought PLUS the
    // visible output. Multiply the caller's requested output budget so the
    // model has room for both reasoning and the actual response.
    body.max_completion_tokens = Math.max(requestedTokens * 4, 16000);
  } else {
    body.max_tokens = requestedTokens;
    body.temperature = options.temperature ?? config.temperature;
  }

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  console.log(`[LLM] Calling ${config.provider}/${config.model} (reasoning=${reasoning}, tokens=${body.max_completion_tokens ?? body.max_tokens})`);

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`[${config.provider}] API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content ?? '';
  const finishReason = choice?.finish_reason;

  if (!content) {
    console.error(`[LLM] Empty content from ${config.model}. finish_reason=${finishReason}, refusal=${choice?.message?.refusal ?? 'none'}`);
    if (data.usage) {
      console.error(`[LLM] Token usage: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, reasoning=${data.usage.completion_tokens_details?.reasoning_tokens ?? 'n/a'}`);
    }
  }

  return {
    content,
    model: data.model ?? config.model,
    provider: config.provider,
    usage: data.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  };
}

// ─── Anthropic (Claude) ───

async function callAnthropic(config: LLMConfig, options: LLMCallOptions): Promise<LLMResponse> {
  const systemMsg = options.messages.find(m => m.role === 'system');
  const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

  const body: any = {
    model: config.model,
    max_tokens: options.maxTokens ?? config.maxTokens,
    temperature: options.temperature ?? config.temperature,
    messages: nonSystemMessages.map(m => ({ role: m.role, content: m.content })),
  };

  if (systemMsg) {
    body.system = systemMsg.content;
  }

  const response = await fetch(`${config.baseUrl}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`[anthropic] API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === 'text');

  return {
    content: textBlock?.text ?? '',
    model: data.model ?? config.model,
    provider: 'anthropic',
    usage: data.usage ? {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
    } : undefined,
  };
}

// ─── Google Gemini ───

async function callGoogle(config: LLMConfig, options: LLMCallOptions): Promise<LLMResponse> {
  const systemMsg = options.messages.find(m => m.role === 'system');
  const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

  const contents = nonSystemMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? config.temperature,
      maxOutputTokens: options.maxTokens ?? config.maxTokens,
    },
  };

  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  if (options.jsonMode) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  const url = `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`[google] API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? '';

  return {
    content: text,
    model: config.model,
    provider: 'google',
    usage: data.usageMetadata ? {
      promptTokens: data.usageMetadata.promptTokenCount ?? 0,
      completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      totalTokens: data.usageMetadata.totalTokenCount ?? 0,
    } : undefined,
  };
}
