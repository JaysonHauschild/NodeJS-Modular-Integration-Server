'use strict';

const EVENT_NAME = /^[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*:[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)*$/;

class EventBusError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'EventBusError';
    this.code = code;
  }
}

function validateEventName(name) {
  if (typeof name !== 'string' || !EVENT_NAME.test(name)) {
    throw new EventBusError(
      'Event names must use the namespace:event-name format',
      'INVALID_EVENT_NAME',
    );
  }
  return name.split(':', 1)[0];
}

class ModuleEventApi {
  #bus;
  #moduleName;

  constructor(bus, moduleName) {
    this.#bus = bus;
    this.#moduleName = moduleName;
    Object.freeze(this);
  }

  create(name) {
    return this.#bus.create(this.#moduleName, name);
  }

  emit(name, payload) {
    return this.#bus.emit(this.#moduleName, name, payload);
  }

  on(name, handler) {
    return this.#bus.on(this.#moduleName, name, handler);
  }

  once(name, handler) {
    let fired = false;
    let unsubscribe;
    unsubscribe = this.on(name, async (payload, event) => {
      if (fired) return undefined;
      fired = true;
      unsubscribe();
      return handler(payload, event);
    });
    return unsubscribe;
  }
}

class EventBus {
  #definitions = new Map();
  #listeners = new Map();
  #logger;
  #moduleApis = new Map();

  constructor({ logger } = {}) {
    this.#logger = logger;
  }

  forModule(moduleName) {
    if (typeof moduleName !== 'string' || moduleName.length === 0) {
      throw new TypeError('A module name is required for its event API');
    }
    if (!this.#moduleApis.has(moduleName)) {
      this.#moduleApis.set(moduleName, new ModuleEventApi(this, moduleName));
    }
    return this.#moduleApis.get(moduleName);
  }

  create(moduleName, name) {
    const namespace = validateEventName(name);
    if (namespace !== moduleName) {
      throw new EventBusError(
        `Module ${moduleName} cannot create events in the ${namespace} namespace`,
        'EVENT_NAMESPACE_FORBIDDEN',
      );
    }
    if (this.#definitions.has(name)) {
      throw new EventBusError(`Event ${name} already exists`, 'EVENT_ALREADY_EXISTS');
    }
    this.#definitions.set(name, Object.freeze({ name, namespace, createdBy: moduleName }));
    this.#logger?.info('Event created', { event: name, module: moduleName });
    return this.#definitions.get(name);
  }

  on(moduleName, name, handler) {
    validateEventName(name);
    if (typeof handler !== 'function') throw new TypeError('An event handler must be a function');

    const listener = { moduleName, handler };
    const listeners = this.#listeners.get(name) || new Set();
    listeners.add(listener);
    this.#listeners.set(name, listeners);

    let active = true;
    return () => {
      if (!active) return false;
      active = false;
      listeners.delete(listener);
      if (listeners.size === 0) this.#listeners.delete(name);
      return true;
    };
  }

  async emit(moduleName, name, payload) {
    const namespace = validateEventName(name);
    if (namespace !== moduleName) {
      throw new EventBusError(
        `Module ${moduleName} cannot emit events in the ${namespace} namespace`,
        'EVENT_NAMESPACE_FORBIDDEN',
      );
    }
    if (!this.#definitions.has(name)) {
      throw new EventBusError(`Event ${name} has not been created`, 'EVENT_NOT_FOUND');
    }

    const event = Object.freeze({
      name,
      namespace,
      emittedBy: moduleName,
      emittedAt: new Date().toISOString(),
    });
    const listeners = [...(this.#listeners.get(name) || [])];
    const results = await Promise.allSettled(
      listeners.map(({ handler }) => Promise.resolve().then(() => handler(payload, event))),
    );
    let failed = 0;
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        failed += 1;
        this.#logger?.error('Event listener failed', {
          error: result.reason?.message || String(result.reason),
          event: name,
          listenerModule: listeners[index].moduleName,
        });
      }
    });
    this.#logger?.info('Event emitted', {
      delivered: listeners.length - failed,
      event: name,
      failed,
      module: moduleName,
    });
    return Object.freeze({ delivered: listeners.length - failed, failed });
  }

  removeModule(moduleName) {
    for (const [name, listeners] of this.#listeners) {
      for (const listener of listeners) {
        if (listener.moduleName === moduleName) listeners.delete(listener);
      }
      if (listeners.size === 0) this.#listeners.delete(name);
    }
    for (const [name, definition] of this.#definitions) {
      if (definition.createdBy === moduleName) this.#definitions.delete(name);
    }
    this.#moduleApis.delete(moduleName);
  }

  clear() {
    this.#definitions.clear();
    this.#listeners.clear();
    this.#moduleApis.clear();
  }
}

function createEventBus(options) {
  return new EventBus(options);
}

module.exports = { EventBus, EventBusError, ModuleEventApi, createEventBus };
