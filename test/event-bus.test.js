'use strict';

const assert = require('node:assert/strict');
const { describe, test } = require('node:test');
const { EventBusError, createEventBus } = require('../src/event-bus');

const quietLogger = { info() {}, error() {} };

describe('module event API', () => {
  test('delivers namespaced events without exposing handler functions to producers', async () => {
    const bus = createEventBus({ logger: quietLogger });
    const weatherEvents = bus.forModule('openweather');
    const alertEvents = bus.forModule('weather-alerts');
    const received = [];

    alertEvents.on('openweather:bad-weather', (payload, event) => {
      received.push({ payload, event });
    });
    weatherEvents.create('openweather:bad-weather');
    const result = await weatherEvents.emit('openweather:bad-weather', {
      city: 'Seattle', conditions: ['Rain'],
    });

    assert.deepEqual(result, { delivered: 1, failed: 0 });
    assert.deepEqual(received[0].payload, { city: 'Seattle', conditions: ['Rain'] });
    assert.equal(received[0].event.name, 'openweather:bad-weather');
    assert.equal(received[0].event.emittedBy, 'openweather');
  });

  test('enforces event namespaces for creation and emission', async () => {
    const bus = createEventBus({ logger: quietLogger });
    const alerts = bus.forModule('weather-alerts');
    assert.throws(
      () => alerts.create('openweather:bad-weather'),
      (error) => error instanceof EventBusError && error.code === 'EVENT_NAMESPACE_FORBIDDEN',
    );
    await assert.rejects(
      alerts.emit('openweather:bad-weather', {}),
      (error) => error instanceof EventBusError && error.code === 'EVENT_NAMESPACE_FORBIDDEN',
    );
  });

  test('requires an event to be created before emission', async () => {
    const events = createEventBus({ logger: quietLogger }).forModule('openweather');
    await assert.rejects(
      events.emit('openweather:bad-weather', {}),
      (error) => error instanceof EventBusError && error.code === 'EVENT_NOT_FOUND',
    );
  });

  test('isolates listener failures and supports one-use listeners', async () => {
    const bus = createEventBus({ logger: quietLogger });
    const source = bus.forModule('source');
    const listener = bus.forModule('listener');
    let calls = 0;
    source.create('source:changed');
    listener.on('source:changed', () => { throw new Error('listener failed'); });
    listener.once('source:changed', () => { calls += 1; });

    assert.deepEqual(await source.emit('source:changed'), { delivered: 1, failed: 1 });
    assert.deepEqual(await source.emit('source:changed'), { delivered: 0, failed: 1 });
    assert.equal(calls, 1);
  });

  test('removes a module subscriptions during cleanup', async () => {
    const bus = createEventBus({ logger: quietLogger });
    const source = bus.forModule('source');
    const listener = bus.forModule('listener');
    let calls = 0;
    source.create('source:changed');
    listener.on('source:changed', () => { calls += 1; });
    bus.removeModule('listener');

    assert.deepEqual(await source.emit('source:changed'), { delivered: 0, failed: 0 });
    assert.equal(calls, 0);
  });
});
