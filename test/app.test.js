'use strict';

const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const { loadConfig } = require('../src/config');
const quietLogger = { info() {}, error() {}, child() { return this; } };

describe('integration server', () => {
  let running;
  let baseUrl;

  before(async () => {
    const config = { ...loadConfig({ PORT: '3000' }), host: '127.0.0.1', port: 0 };
    const { createApp } = require('../src/app');
    const { app, registry } = createApp({ config, logger: quietLogger });
    await registry.initialize();
    const server = app.listen(0, config.host);
    await new Promise((resolve) => server.once('listening', resolve));
    running = { server, registry };
    baseUrl = `http://${config.host}:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => running.server.close(resolve));
    await running.registry.shutdown();
  });

  test('reports health and enabled integrations', async () => {
    const response = await fetch(`${baseUrl}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.deepEqual(body.modules, ['example']);
    assert.ok(response.headers.get('x-request-id'));
  });

  test('mounts integration routes', async () => {
    const response = await fetch(`${baseUrl}/api/example`);
    assert.deepEqual(await response.json(), { integration: 'example', status: 'ready' });
  });

  test('returns structured JSON for unknown routes', async () => {
    const response = await fetch(`${baseUrl}/missing`, { headers: { 'x-request-id': 'test-id' } });
    const body = await response.json();
    assert.equal(response.status, 404);
    assert.deepEqual(body, { error: { message: 'Route GET /missing not found', requestId: 'test-id' } });
  });
});
