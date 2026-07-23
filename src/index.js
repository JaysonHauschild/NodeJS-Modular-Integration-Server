'use strict';

const { loadConfig } = require('./config');
const { startServer } = require('./server');

function loadLocalEnvironment() {
  try {
    process.loadEnvFile();
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function main() {
  loadLocalEnvironment();
  const running = await startServer(loadConfig());
  process.once('SIGINT', () => running.stop('SIGINT'));
  process.once('SIGTERM', () => running.stop('SIGTERM'));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ level: 'fatal', message: error.message }));
    process.exitCode = 1;
  });
}

module.exports = { loadLocalEnvironment };
