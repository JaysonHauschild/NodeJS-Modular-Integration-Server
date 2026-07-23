'use strict';

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { ApiKeyError, createApiKeyStore } = require('../src/api-keys');
const { createLogger, redact } = require('../src/logger');

describe('API key store', () => {
  test('reads configured keys and builds authorization headers', () => {
    const keys = createApiKeyStore({ environment: { SERVICE_API_KEY: 'a-secure-value' } });
    assert.equal(keys.has('SERVICE_API_KEY'), true);
    assert.equal(keys.get('SERVICE_API_KEY'), 'a-secure-value');
    assert.deepEqual(keys.authorizationHeaders('SERVICE_API_KEY'), {
      authorization: 'Bearer a-secure-value',
    });
  });

  test('supports optional keys without disclosing missing values', () => {
    const keys = createApiKeyStore({ environment: {} });
    assert.equal(keys.get('OPTIONAL_API_KEY', { required: false }), undefined);
    assert.throws(
      () => keys.get('REQUIRED_API_KEY'),
      (error) => error instanceof ApiKeyError && error.code === 'API_KEY_MISSING',
    );
  });

  test('rejects unsafe names and values', () => {
    assert.throws(() => createApiKeyStore().get('bad-name'), /uppercase letters/);
    assert.throws(
      () => createApiKeyStore({ environment: { BAD_KEY: 'value\nInjected: header' } }).get('BAD_KEY'),
      /control characters/,
    );
  });

  test('compares inbound keys without direct string comparison', () => {
    const keys = createApiKeyStore({ environment: { WEBHOOK_API_KEY: 'expected-key' } });
    assert.equal(keys.matches('WEBHOOK_API_KEY', 'expected-key'), true);
    assert.equal(keys.matches('WEBHOOK_API_KEY', 'incorrect'), false);
  });

  test('redacts credential fields from structured logs', () => {
    assert.deepEqual(
      redact({ apiKey: 'secret', nested: { authorization: 'Bearer secret', safe: 'visible' } }),
      { apiKey: '[REDACTED]', nested: { authorization: '[REDACTED]', safe: 'visible' } },
    );
  });

  test('writes human-readable named log messages with redacted details', () => {
    const originalLog = console.log;
    const output = [];
    console.log = (message) => output.push(message);
    try {
      createLogger({ service: 'integration-server' }).info('Request completed', {
        status: 200,
        apiKey: 'secret',
      });
    } finally {
      console.log = originalLog;
    }

    assert.deepEqual(output, [
      '[INFO] integration-server Request completed {"status":200,"apiKey":"[REDACTED]"}',
    ]);
  });
});
