import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { OpenAICompatibleProvider } from '../src/core/providers/openaiCompatible.js';

type Recorded = { path: string; auth: string | undefined; body: any };
type Reply = { status: number; json: unknown };

// A tiny fake "AI provider" running on localhost, so tests need no real API
function startFake(reply: Reply) {
  const requests: Recorded[] = [];
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      requests.push({
        path: req.url ?? '',
        auth: req.headers.authorization,
        body: raw ? JSON.parse(raw) : null,
      });
      res.writeHead(reply.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(reply.json));
    });
  });
  return new Promise<{ baseUrl: string; requests: Recorded[]; close: () => Promise<void> }>(
    (resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo;
        resolve({
          baseUrl: `http://127.0.0.1:${port}/v1`,
          requests,
          close: () => new Promise<void>((done) => server.close(() => done())),
        });
      });
    },
  );
}

test('sends model and messages, returns text and usage', async () => {
  const fake = await startFake({
    status: 200,
    json: {
      choices: [{ message: { role: 'assistant', content: 'Բարև!' } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    },
  });
  const provider = new OpenAICompatibleProvider({
    id: 'test',
    baseUrl: fake.baseUrl,
    apiKey: 'test-key',
    model: 'model-x',
  });

  const result = await provider.generate([{ role: 'user', content: 'Hello' }]);

  assert.equal(result.text, 'Բարև!');
  assert.deepEqual(result.usage, { inputTokens: 12, outputTokens: 3 });
  assert.equal(result.modelId, 'model-x');

  const req = fake.requests[0];
  assert.equal(req?.path, '/v1/chat/completions');
  assert.equal(req?.auth, 'Bearer test-key');
  assert.equal(req?.body.model, 'model-x');
  assert.deepEqual(req?.body.messages, [{ role: 'user', content: 'Hello' }]);
  await fake.close();
});

test('usage is null when the provider omits it', async () => {
  const fake = await startFake({
    status: 200,
    json: { choices: [{ message: { content: 'ok' } }] },
  });
  const provider = new OpenAICompatibleProvider({
    id: 'test',
    baseUrl: fake.baseUrl,
    apiKey: 'k',
    model: 'm',
  });
  const result = await provider.generate([{ role: 'user', content: 'x' }]);
  assert.equal(result.usage, null);
  await fake.close();
});

test('HTTP errors are reported without leaking the API key', async () => {
  const fake = await startFake({ status: 401, json: { error: 'bad key' } });
  const provider = new OpenAICompatibleProvider({
    id: 'prov-a',
    baseUrl: fake.baseUrl,
    apiKey: 'SECRET-KEY',
    model: 'm',
  });
  await assert.rejects(
    () => provider.generate([{ role: 'user', content: 'x' }]),
    (err: Error) => err.message.includes('prov-a') && err.message.includes('401') && !err.message.includes('SECRET-KEY'),
  );
  await fake.close();
});

test('throws when the response has no message content', async () => {
  const fake = await startFake({ status: 200, json: { choices: [] } });
  const provider = new OpenAICompatibleProvider({
    id: 'test',
    baseUrl: fake.baseUrl,
    apiKey: 'k',
    model: 'm',
  });
  await assert.rejects(() => provider.generate([{ role: 'user', content: 'x' }]), /no message content/);
  await fake.close();
});

test('sends no Authorization header when the API key is empty (local servers)', async () => {
  const fake = await startFake({
    status: 200,
    json: { choices: [{ message: { content: 'ok' } }] },
  });
  const provider = new OpenAICompatibleProvider({
    id: 'local',
    baseUrl: fake.baseUrl,
    apiKey: '',
    model: 'm',
  });
  await provider.generate([{ role: 'user', content: 'x' }]);
  assert.equal(fake.requests[0]?.auth, undefined);
  await fake.close();
});
