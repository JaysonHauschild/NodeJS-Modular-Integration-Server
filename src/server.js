'use strict';

const http = require('node:http');
const { createApp } = require('./app');
const { createLogger } = require('./logger');

async function startServer(config) {
  const logger = createLogger({ service: 'integration-server' });
  const { app, registry } = createApp({ config, logger });
  const server = http.createServer(app);

  await registry.initialize();

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, config.host, resolve);
    });
  } catch (error) {
    await registry.shutdown();
    throw error;
  }

  logger.info('Server listening', { host: config.host, port: config.port, environment: config.env });

  let stopping = false;
  async function stop(signal = 'manual') {
    if (stopping) return;
    stopping = true;
    logger.info('Server stopping', { signal });

    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out');
      server.closeAllConnections();
    }, config.shutdownTimeoutMs);
    timeout.unref();

    await new Promise((resolve) => server.close(resolve));
    await registry.shutdown();
    clearTimeout(timeout);
    logger.info('Server stopped');
  }

  return { app, server, stop };
}

module.exports = { startServer };
