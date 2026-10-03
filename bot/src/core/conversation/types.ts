// Provider-neutral message format.
// Nothing in src/core may depend on Mattermost or on any AI provider.

export type Role = 'system' | 'user' | 'assistant';

// What we pass in when saving a message
export interface NewMessage {
  conversationId: string;
  role: Role;
  content: string;
  modelId?: string; // which model wrote an assistant message (useful later for model switching)
}

// What we get back from the store
export interface Message extends NewMessage {
  id: number;
  createdAt: string; // ISO 8601 timestamp
}
