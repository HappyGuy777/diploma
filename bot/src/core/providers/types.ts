import type { Role } from '../conversation/types.js';

// What we send to a model: provider-neutral
export interface ChatMessage {
  role: Role;
  content: string;
}

// Token counts as reported by the provider (used later for cost tracking)
export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface GenerateResult {
  text: string;
  usage: Usage | null; // null when the provider does not report usage
  modelId: string;
}

// Every provider adapter (OpenAI-compatible, Ollama, Claude, ...) implements this.
export interface ModelProvider {
  readonly id: string; // our own name for it, for example "provider-a"
  generate(messages: ChatMessage[]): Promise<GenerateResult>;
}
