import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SqliteConversationStore } from '../src/core/conversation/sqliteStore.js';

test('saves messages and returns them in order', () => {
  const store = new SqliteConversationStore(':memory:');
  store.addMessage({ conversationId: 'c1', role: 'user', content: 'Hello' });
  store.addMessage({ conversationId: 'c1', role: 'assistant', content: 'Hi!', modelId: 'model-a' });

  const msgs = store.getMessages('c1');
  assert.equal(msgs.length, 2);
  assert.deepEqual(msgs.map((m) => m.content), ['Hello', 'Hi!']);
  assert.equal(msgs[0]?.role, 'user');
  assert.equal(msgs[0]?.modelId, undefined);
  assert.equal(msgs[1]?.modelId, 'model-a');
  store.close();
});

test('keeps conversations separate', () => {
  const store = new SqliteConversationStore(':memory:');
  store.addMessage({ conversationId: 'a', role: 'user', content: 'in a' });
  store.addMessage({ conversationId: 'b', role: 'user', content: 'in b' });

  assert.deepEqual(store.getMessages('a').map((m) => m.content), ['in a']);
  assert.deepEqual(store.getMessages('b').map((m) => m.content), ['in b']);
  store.close();
});

test('clear removes only the chosen conversation', () => {
  const store = new SqliteConversationStore(':memory:');
  store.addMessage({ conversationId: 'a', role: 'user', content: 'x' });
  store.addMessage({ conversationId: 'b', role: 'user', content: 'y' });

  store.clear('a');
  assert.equal(store.getMessages('a').length, 0);
  assert.equal(store.getMessages('b').length, 1);
  store.close();
});

test('stores Armenian text unchanged', () => {
  const store = new SqliteConversationStore(':memory:');
  const text = 'Բարև, ինչպե՞ս ես։';
  store.addMessage({ conversationId: 'c', role: 'user', content: text });
  assert.equal(store.getMessages('c')[0]?.content, text);
  store.close();
});

test('database rejects an invalid role', () => {
  const store = new SqliteConversationStore(':memory:');
  assert.throws(() =>
    store.addMessage({ conversationId: 'c', role: 'bad' as never, content: 'x' }),
  );
  store.close();
});
