'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { loadConfig } = require('../src/config');

test('loads and converts environment configuration', () => {
  const config = loadConfig({
    NODE_ENV: 'production',
    PORT: '8080',
    INTEGRATION_HTTP_RETRIES: '4',
    INTEGRATION_HTTP_TIMEOUT_MS: '2500',
    SHUTDOWN_TIMEOUT_MS: '5000',
  });
  assert.equal(config.port, 8080);
  assert.equal(config.isProduction, true);
  assert.equal(config.httpRetries, 4);
  assert.equal(config.httpTimeoutMs, 2500);
  assert.equal(config.shutdownTimeoutMs, 5000);
});

test('rejects an invalid port', () => {
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT must be a positive integer/);
});
