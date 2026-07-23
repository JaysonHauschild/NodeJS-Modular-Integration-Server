'use strict';

function positiveInteger(value, fallback, name, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new Error(`${name} must be a positive integer no greater than ${maximum}`);
  }
  return parsed;
}

function nonNegativeInteger(value, fallback, name) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function loadConfig(environment = process.env) {
  const nodeEnv = environment.NODE_ENV || 'development';

  return Object.freeze({
    env: nodeEnv,
    isProduction: nodeEnv === 'production',
    host: environment.HOST || '0.0.0.0',
    port: positiveInteger(environment.PORT, 3000, 'PORT', 65_535),
    jsonLimit: environment.JSON_LIMIT || '1mb',
    httpTimeoutMs: positiveInteger(
      environment.INTEGRATION_HTTP_TIMEOUT_MS,
      10_000,
      'INTEGRATION_HTTP_TIMEOUT_MS',
    ),
    httpRetries: nonNegativeInteger(environment.INTEGRATION_HTTP_RETRIES, 2, 'INTEGRATION_HTTP_RETRIES'),
    shutdownTimeoutMs: positiveInteger(
      environment.SHUTDOWN_TIMEOUT_MS,
      10_000,
      'SHUTDOWN_TIMEOUT_MS',
    ),
  });
}

module.exports = { loadConfig };
