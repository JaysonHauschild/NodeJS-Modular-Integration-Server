'use strict';

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { ModuleContext } = require('../src/module-context');
const { createModuleRegistry } = require('../src/module-registry');

function createServices() {
  const logger = {
    info() {},
    error() {},
    child(fields) { return { ...this, label: fields.integration }; },
  };
  return {
    config: Object.freeze({ env: 'test' }),
    logger,
    apiKeys: { get() {}, clear() {} },
    httpClient: { request() {} },
    eventBus: {
      forModule() { return { create() {}, emit() {}, on() {} }; },
      removeModule() {},
      clear() {},
    },
    internalServerMethod() {},
  };
}

describe('module context', () => {
  test('exposes only approved server capabilities', () => {
    const services = createServices();
    const context = new ModuleContext({
      moduleName: 'weather',
      ...services,
      events: services.eventBus.forModule('weather'),
    });

    assert.equal(context.moduleName, 'weather');
    assert.equal(context.config, services.config);
    assert.equal(context.logger, services.logger);
    assert.equal(context.apiKeys, services.apiKeys);
    assert.equal(context.httpClient, services.httpClient);
    assert.equal(typeof context.events.emit, 'function');
    assert.equal(context.internalServerMethod, undefined);
    assert.equal(Object.isFrozen(context), true);
    assert.throws(() => { context.server = {}; }, TypeError);
  });

  test('registry provides the same scoped context to lifecycle hooks', async () => {
    const services = createServices();
    const received = [];
    const module = {
      name: 'weather',
      mountPath: '/weather',
      router() {},
      initialize(context) { received.push(context); },
      shutdown(context) { received.push(context); },
    };
    const registry = createModuleRegistry([module], services);

    await registry.initialize();
    await registry.shutdown();

    assert.equal(received.length, 2);
    assert.equal(received[0], received[1]);
    assert.equal(received[0] instanceof ModuleContext, true);
    assert.equal(received[0].logger.label, 'weather');
  });
});
