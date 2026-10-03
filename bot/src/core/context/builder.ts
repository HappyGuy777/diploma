import type { Message } from '../conversation/types.js';
import type { ChatMessage } from '../providers/types.js';
import type { TokenCounter } from './tokenCounter.js';

export interface ContextOptions {
  contextWindowTokens: number; // the model's total context window
  replyReserveTokens: number; // room kept free for the model's answer
  counter: TokenCounter;
  systemPrompt?: string;
  maxMessages?: number; // optional hard cap on how many history messages to send
  perMessageOverhead?: number; // extra tokens per message for role/formatting (default 4)
}

export interface BuiltContext {
  messages: ChatMessage[];
  estimatedTokens: number;
  droppedCount: number; // how many history messages did not fit
}

export class ContextTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContextTooLargeError';
  }
}

// Strategy 1: keep the most recent messages that fit into the token budget.
export function buildContext(history: Message[], options: ContextOptions): BuiltContext {
  const overhead = options.perMessageOverhead ?? 4;
  const cost = (text: string) => options.counter.count(text) + overhead;
  const maxMessages = options.maxMessages ?? Number.POSITIVE_INFINITY;
  if (maxMessages < 1) throw new Error('maxMessages must be at least 1');

  const head: ChatMessage[] = [];
  let used = 0;

  if (options.systemPrompt) {
    used += cost(options.systemPrompt);
    head.push({ role: 'system', content: options.systemPrompt });
  }

  const budget = options.contextWindowTokens - options.replyReserveTokens;
  if (used >= budget) {
    throw new ContextTooLargeError('The system prompt leaves no room in the context window');
  }

  // Walk from the newest message to the oldest and stop when the budget is full
  const recent: ChatMessage[] = [];
  for (let i = history.length - 1; i >= 0 && recent.length < maxMessages; i--) {
    const m = history[i];
    if (!m) break;
    const c = cost(m.content);
    if (used + c > budget) break;
    used += c;
    recent.push({ role: m.role, content: m.content });
  }

  if (history.length > 0 && recent.length === 0) {
    throw new ContextTooLargeError('The newest message does not fit into the context window');
  }

  recent.reverse(); // back to chronological order
  return {
    messages: [...head, ...recent],
    estimatedTokens: used,
    droppedCount: history.length - recent.length,
  };
}
