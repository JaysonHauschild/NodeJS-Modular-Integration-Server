'use strict';

class ModuleContext {
  #apiKeys;
  #config;
  #events;
  #httpClient;
  #logger;
  #moduleName;

  constructor({ moduleName, config, logger, apiKeys, httpClient, events }) {
    if (typeof moduleName !== 'string' || moduleName.length === 0) {
      throw new TypeError('ModuleContext requires a module name');
    }
    if (!config || typeof config !== 'object') {
      throw new TypeError('ModuleContext requires configuration');
    }
    if (!logger || typeof logger.info !== 'function' || typeof logger.error !== 'function') {
      throw new TypeError('ModuleContext requires a logger');
    }
    if (!apiKeys || typeof apiKeys.get !== 'function') {
      throw new TypeError('ModuleContext requires an API key handler');
    }
    if (!httpClient || typeof httpClient.request !== 'function') {
      throw new TypeError('ModuleContext requires an HTTP client');
    }
    if (!events || typeof events.create !== 'function' || typeof events.emit !== 'function') {
      throw new TypeError('ModuleContext requires an event API');
    }

    this.#moduleName = moduleName;
    this.#config = config;
    this.#logger = logger;
    this.#apiKeys = apiKeys;
    this.#httpClient = httpClient;
    this.#events = events;
    Object.freeze(this);
  }

  get moduleName() {
    return this.#moduleName;
  }

  get config() {
    return this.#config;
  }

  get logger() {
    return this.#logger;
  }

  get apiKeys() {
    return this.#apiKeys;
  }

  get httpClient() {
    return this.#httpClient;
  }

  get events() {
    return this.#events;
  }
}

module.exports = { ModuleContext };
