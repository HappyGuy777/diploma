import type { ChatMessage, GenerateResult, ModelProvider, Usage } from './types.js';

export interface OpenAICompatibleOptions {
  id: string;
  baseUrl: string; // for example https://api.example.com/v1
  apiKey: string; // may be empty for local servers
  model: string;
  timeoutMs?: number;
}

// The parts of the response we read; everything is checked at runtime
type ChatCompletionResponse = {
  choices?: { message?: { content?: unknown } }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

export class OpenAICompatibleProvider implements ModelProvider {
  readonly id: string;

  constructor(private opts: OpenAICompatibleOptions) {
    this.id = opts.id;
  }

  async generate(messages: ChatMessage[]): Promise<GenerateResult> {
    const url = `${this.opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.opts.apiKey) headers['Authorization'] = `Bearer ${this.opts.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: this.opts.model, messages }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 60_000),
    });

    if (!res.ok) {
      // Never include the API key in error messages
      const detail = (await res.text()).slice(0, 500);
      throw new Error(`Provider ${this.id} returned HTTP ${res.status}: ${detail}`);
    }

    const data = (await res.json()) as ChatCompletionResponse;

    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      throw new Error(`Provider ${this.id} returned no message content`);
    }

    let usage: Usage | null = null;
    const u = data.usage;
    if (u && typeof u.prompt_tokens === 'number' && typeof u.completion_tokens === 'number') {
      usage = { inputTokens: u.prompt_tokens, outputTokens: u.completion_tokens };
    }

    return { text, usage, modelId: this.opts.model };
  }
}
