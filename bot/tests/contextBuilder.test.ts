import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, ContextTooLargeError } from '../src/core/context/builder.js';
import { HeuristicTokenCounter } from '../src/core/context/tokenCounter.js';
import type { Message, Role } from '../src/core/conversation/types.js';

// Simple counter for tests: 1 character = 1 token
const counter = { count: (t: string) => t.length };
const base = {
  contextWindowTokens: 100,
  replyReserveTokens: 20, // budget = 80
  counter,
  perMessageOverhead: 0,
};

function msg(id: number, role: Role, content: string): Message {
  return { id, conversationId: 'c', role, content, createdAt: 't' };
}

test('includes everything in order when it fits, system prompt first', () => {
  const history = [msg(1, 'user', 'aaaa'), msg(2, 'assistant', 'bbbb'), msg(3, 'user', 'cccc')];
  const out = buildContext(history, { ...base, systemPrompt: 'sys' });

  assert.deepEqual(
    out.messages.map((m) => [m.role, m.content]),
    [
      ['system', 'sys'],
      ['user', 'aaaa'],
      ['assistant', 'bbbb'],
      ['user', 'cccc'],
    ],
  );
  assert.equal(out.droppedCount, 0);
  assert.equal(out.estimatedTokens, 3 + 12);
});

test('drops the oldest messages first when over budget', () => {
  const big = (c: string) => c.repeat(30);
  const history = [msg(1, 'user', big('a')), msg(2, 'assistant', big('b')), msg(3, 'user', big('c'))];
  const out = buildContext(history, base); // 90 tokens > budget 80

  assert.deepEqual(out.messages.map((m) => m.content[0]), ['b', 'c']);
  assert.equal(out.droppedCount, 1);
  assert.equal(out.estimatedTokens, 60);
});

test('respects maxMessages and keeps the newest', () => {
  const history = [msg(1, 'user', 'a'), msg(2, 'assistant', 'b'), msg(3, 'user', 'c'), msg(4, 'assistant', 'd')];
  const out = buildContext(history, { ...base, maxMessages: 2 });

  assert.deepEqual(out.messages.map((m) => m.content), ['c', 'd']);
  assert.equal(out.droppedCount, 2);
});

test('throws when the newest message alone does not fit', () => {
  const history = [msg(1, 'user', 'x'.repeat(200))];
  assert.throws(() => buildContext(history, base), ContextTooLargeError);
});

test('throws when the system prompt leaves no room', () => {
  assert.throws(
    () => buildContext([msg(1, 'user', 'hi')], { ...base, systemPrompt: 's'.repeat(90) }),
    ContextTooLargeError,
  );
});

test('empty history returns only the system prompt', () => {
  const out = buildContext([], { ...base, systemPrompt: 'sys' });
  assert.deepEqual(out.messages, [{ role: 'system', content: 'sys' }]);
  assert.equal(out.droppedCount, 0);
});

test('placeholder estimator counts Armenian higher than English of equal length', () => {
  const hy = 'Բարև ձեզ։';
  const en = 'Hello abc';
  assert.equal(hy.length, en.length);
  const c = new HeuristicTokenCounter();
  assert.ok(c.count(hy) > c.count(en));
});
