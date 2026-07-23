'use strict';

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { createApiKeyStore } = require('../src/api-keys');
const { HttpClientError, createHttpClient } = require('../src/http-client');

describe('shared HTTP client', () => {
  test('attaches API keys and request IDs without changing caller headers', async () => {
    const originalHeaders = { 'x-custom': 'value' };
    let received;
    const client = createHttpClient({
      apiKeys: createApiKeyStore({ environment: { SERVICE_API_KEY: 'secret-value' } }),
      fetchImpl: async (_url, options) => {
        received = options;
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    await client.request('https://service.example/path?token=must-not-be-logged', {
      apiKey: { name: 'SERVICE_API_KEY', header: 'x-api-key' },
      headers: originalHeaders,
    });

    assert.equal(received.headers.get('x-api-key'), 'secret-value');
    assert.equal(received.headers.get('x-custom'), 'value');
    assert.ok(received.headers.get('x-request-id'));
    assert.deepEqual(originalHeaders, { 'x-custom': 'value' });
  });

  test('serializes and parses JSON', async () => {
    const client = createHttpClient({
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers.get('content-type'), 'application/json');
        assert.equal(options.body, '{"hello":"world"}');
        return new Response('{"ok":true}', { status: 200 });
      },
    });
    assert.deepEqual(
      await client.requestJson('https://service.example/items', {
        method: 'POST', json: { hello: 'world' }, retries: 0,
      }),
      { ok: true },
    );
  });

  test('retries transient failures for safe methods', async () => {
    let calls = 0;
    const client = createHttpClient({
      fetchImpl: async () => {
        calls += 1;
        return new Response(calls === 1 ? 'unavailable' : 'ok', { status: calls === 1 ? 503 : 200 });
      },
      retryBaseDelayMs: 0,
      sleep: async () => {},
    });
    const response = await client.request('https://service.example/items');
    assert.equal(await response.text(), 'ok');
    assert.equal(calls, 2);
  });

  test('does not retry unsafe methods unless explicitly enabled', async () => {
    let calls = 0;
    const client = createHttpClient({
      fetchImpl: async () => {
        calls += 1;
        return new Response('unavailable', { status: 503 });
      },
    });
    await assert.rejects(
      client.request('https://service.example/items', { method: 'POST' }),
      (error) => error instanceof HttpClientError
        && error.code === 'UPSTREAM_ERROR'
        && error.status === 503
        && error.retryable,
    );
    assert.equal(calls, 1);
  });

  test('normalizes timeouts', async () => {
    const client = createHttpClient({
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
    });
    await assert.rejects(
      client.request('https://service.example/slow', { retries: 0, timeoutMs: 10 }),
      (error) => error instanceof HttpClientError && error.code === 'REQUEST_TIMEOUT',
    );
  });

  test('logs URLs without query-string secrets', async () => {
    const entries = [];
    const logger = {
      info(message, fields) { entries.push({ message, fields }); },
      error(message, fields) { entries.push({ message, fields }); },
    };
    const client = createHttpClient({ logger, fetchImpl: async () => new Response('ok') });
    await client.request('https://service.example/path?api_key=secret');
    assert.equal(entries[0].fields.url, 'https://service.example/path');
    assert.equal(JSON.stringify(entries).includes('secret'), false);
  });
});
