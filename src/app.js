'use strict';

const express = require('express');
const { createApiKeyStore } = require('./api-keys');
const { createHttpClient } = require('./http-client');
const { createEventBus } = require('./event-bus');
const { createLogger } = require('./logger');
const { errorHandler, notFound } = require('./middleware/errors');
const { requestContext } = require('./middleware/request-context');
const { createModuleRegistry } = require('./module-registry');
const { createDefaultModules } = require('./modules');

function createApp({
  config,
  logger = createLogger(),
  modules = createDefaultModules(),
  apiKeys = createApiKeyStore(),
  eventBus = createEventBus({ logger }),
  httpClient = createHttpClient({
    apiKeys,
    logger,
    defaultRetries: config.httpRetries,
    defaultTimeoutMs: config.httpTimeoutMs,
  }),
}) {
  const app = express();
  const registry = createModuleRegistry(modules, {
    config,
    logger,
    apiKeys,
    httpClient,
    eventBus,
  });

  app.disable('x-powered-by');
  app.use(requestContext);
  app.use((request, _response, next) => {
    request.logger = logger;
    next();
  });
  app.use(express.json({ limit: config.jsonLimit }));

  registry.mount(app);
  app.use(notFound);
  app.use(errorHandler);

  return { app, registry };
}

module.exports = { createApp };
