# LLM Integration

Centralized AI/LLM provider configuration. All LLM calls across the app go through this module.

## Files

- **config.ts** - Provider & model configuration (env-driven)
- **client.ts** - Unified `callLLM()` function supporting multiple providers
- **analyzer.ts** - Swing trading analysis prompts (composite + strategy analysis)

## Switching Models

Set env vars in `.env.local`:

```bash
# Default (OpenAI GPT-5 Mini)
LLM_PROVIDER=openai
LLM_MODEL=gpt-5-mini
OPENAI_API_KEY=sk-...

# DeepSeek R1
LLM_PROVIDER=deepseek
LLM_MODEL=deepseek-reasoner
DEEPSEEK_API_KEY=sk-...

# Anthropic Claude
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
LLM_PROVIDER=google
LLM_MODEL=gemini-2.0-flash
GOOGLE_AI_API_KEY=AIza...
```

If `LLM_PROVIDER` / `LLM_MODEL` are not set, defaults to **OpenAI gpt-5-mini**.

## Supported Providers

| Provider | API Compatibility | Env Key |
|----------|------------------|---------|
| OpenAI | Native | `OPENAI_API_KEY` |
| DeepSeek | OpenAI-compatible | `DEEPSEEK_API_KEY` |
| Anthropic | Claude Messages API | `ANTHROPIC_API_KEY` |
| Google | Gemini API | `GOOGLE_AI_API_KEY` |
