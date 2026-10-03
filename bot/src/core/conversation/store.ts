import type { Message, NewMessage } from './types.js';

// The contract for saving and loading conversations.
// The first implementation will use SQLite; keeping an interface lets us
// test the rest of the code without a database and swap storage later.
export interface ConversationStore {
  addMessage(msg: NewMessage): Message;
  getMessages(conversationId: string): Message[];
  clear(conversationId: string): void;
}
