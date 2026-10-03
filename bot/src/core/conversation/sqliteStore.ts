import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ConversationStore } from './store.js';
import type { Message, NewMessage, Role } from './types.js';

// Shape of a row as stored in the database
type Row = {
  id: number;
  conversation_id: string;
  role: Role;
  content: string;
  model_id: string | null;
  created_at: string;
};

function rowToMessage(r: Row): Message {
  const base = {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    createdAt: r.created_at,
  };
  // modelId is optional: only include it when the row has one
  return r.model_id === null ? base : { ...base, modelId: r.model_id };
}

export class SqliteConversationStore implements ConversationStore {
  private db: DatabaseSync;
  private insert: StatementSync;
  private select: StatementSync;
  private remove: StatementSync;

  // path: a file path, or ':memory:' for an in-memory database (used in tests)
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
        content TEXT NOT NULL,
        model_id TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_conversation
        ON messages (conversation_id, id);
    `);

    this.insert = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, model_id, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    this.select = this.db.prepare(
      'SELECT id, conversation_id, role, content, model_id, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC',
    );
    this.remove = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
  }

  addMessage(msg: NewMessage): Message {
    const createdAt = new Date().toISOString();
    const result = this.insert.run(
      msg.conversationId,
      msg.role,
      msg.content,
      msg.modelId ?? null,
      createdAt,
    );
    return { ...msg, id: Number(result.lastInsertRowid), createdAt };
  }

  getMessages(conversationId: string): Message[] {
    const rows = this.select.all(conversationId) as unknown as Row[];
    return rows.map(rowToMessage);
  }

  clear(conversationId: string): void {
    this.remove.run(conversationId);
  }

  close(): void {
    this.db.close();
  }
}
