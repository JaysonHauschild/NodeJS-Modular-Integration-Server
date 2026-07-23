'use strict';

const { randomUUID } = require('node:crypto');

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

class HttpClientError extends Error {
  constructor(message, { cause, code, method, requestId, retryable = false, status, url } = {}) {
    super(message, { cause });
    this.name = 'HttpClientError';
    this.code = code;
    this.method = method;
    this.requestId = requestId;
    this.retryable = retryable;
    this.status = status;
    this.url = url;
  }
}

function safeUrl(input) {
  const url = new URL(input);
  return `${url.origin}${url.pathname}`;
}

function retryDelay(response, attempt, baseDelayMs, maximumDelayMs) {
  const retryAfter = response?.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const parsed = Number.isFinite(seconds)
      ? seconds * 1_000
      : new Date(retryAfter).getTime() - Date.now();
    if (Number.isFinite(parsed) && parsed >= 0) return Math.min(parsed, maximumDelayMs);
  }

  const exponential = baseDelayMs * (2 ** attempt);
  const jitter = exponential * Math.random() * 0.2;
  return Math.min(exponential + jitter, maximumDelayMs);
}

function attachApiKey(headers, apiKey, apiKeys) {
  if (!apiKey) return;
  if (!apiKeys) throw new TypeError('An API key store is required to attach credentials');

  const { name, header = 'authorization', prefix } = apiKey;
  if (!name) throw new TypeError('apiKey.name is required');
  const value = apiKeys.get(name);
  const normalizedHeader = header.toLowerCase();
  const defaultPrefix = normalizedHeader === 'authorization' ? 'Bearer' : undefined;
  const selectedPrefix = prefix === undefined ? defaultPrefix : prefix;
  headers.set(header, selectedPrefix ? `${selectedPrefix} ${value}` : value);
}

function createHttpClient({
  apiKeys,
  defaultRetries = 2,
  defaultTimeoutMs = 10_000,
  fetchImpl = globalThis.fetch,
  logger,
  maximumRetryDelayMs = 30_000,
  retryBaseDelayMs = 250,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  async function request(input, options = {}) {
    const {
      apiKey,
      retries = defaultRetries,
      retryUnsafeMethods = false,
      timeoutMs = defaultTimeoutMs,
      ...fetchOptions
    } = options;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const requestId = new Headers(fetchOptions.headers).get('x-request-id') || randomUUID();
    const headers = new Headers(fetchOptions.headers);
    headers.set('x-request-id', requestId);
    attachApiKey(headers, apiKey, apiKeys);

    if (!Number.isInteger(retries) || retries < 0) throw new TypeError('retries must be a non-negative integer');
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new TypeError('timeoutMs must be a positive integer');

    const logUrl = safeUrl(input);
    const canRetry = retryUnsafeMethods || IDEMPOTENT_METHODS.has(method);

    for (let attempt = 0; ; attempt += 1) {
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const signal = fetchOptions.signal
        ? AbortSignal.any([fetchOptions.signal, timeoutSignal])
        : timeoutSignal;
      const startedAt = performance.now();

      try {
        const response = await fetchImpl(input, { ...fetchOptions, method, headers, signal });
        const retryable = RETRYABLE_STATUS.has(response.status);

        if (retryable && canRetry && attempt < retries) {
          await response.body?.cancel();
          const delayMs = retryDelay(response, attempt, retryBaseDelayMs, maximumRetryDelayMs);
          logger?.info('Integration request retrying', {
            attempt: attempt + 1,
            delayMs: Math.round(delayMs),
            method,
            requestId,
            status: response.status,
            url: logUrl,
          });
          await sleep(delayMs);
          continue;
        }

        logger?.info('Integration request completed', {
          attempt: attempt + 1,
          durationMs: Math.round(performance.now() - startedAt),
          method,
          requestId,
          status: response.status,
          url: logUrl,
        });

        if (!response.ok) {
          throw new HttpClientError(`Upstream request failed with status ${response.status}`, {
            code: 'UPSTREAM_ERROR', method, requestId, retryable, status: response.status, url: logUrl,
          });
        }
        return response;
      } catch (error) {
        if (error instanceof HttpClientError) throw error;

        const timedOut = timeoutSignal.aborted && !fetchOptions.signal?.aborted;
        const aborted = fetchOptions.signal?.aborted;
        const retryable = !aborted;
        if (retryable && canRetry && attempt < retries) {
          const delayMs = retryDelay(undefined, attempt, retryBaseDelayMs, maximumRetryDelayMs);
          logger?.info('Integration request retrying', {
            attempt: attempt + 1,
            delayMs: Math.round(delayMs),
            method,
            requestId,
            reason: timedOut ? 'timeout' : 'network_error',
            url: logUrl,
          });
          await sleep(delayMs);
          continue;
        }

        const wrapped = new HttpClientError(
          timedOut ? `Upstream request timed out after ${timeoutMs}ms` : 'Upstream request failed',
          {
            cause: error,
            code: timedOut ? 'REQUEST_TIMEOUT' : aborted ? 'REQUEST_ABORTED' : 'NETWORK_ERROR',
            method,
            requestId,
            retryable,
            url: logUrl,
          },
        );
        logger?.error('Integration request failed', {
          code: wrapped.code, method, requestId, url: logUrl,
        });
        throw wrapped;
      }
    }
  }

  async function requestJson(input, options = {}) {
    const { json, ...requestOptions } = options;
    const headers = new Headers(requestOptions.headers);
    headers.set('accept', 'application/json');
    let body = requestOptions.body;
    if (json !== undefined) {
      headers.set('content-type', 'application/json');
      body = JSON.stringify(json);
    }
    const response = await request(input, { ...requestOptions, headers, body });
    return response.json();
  }

  return Object.freeze({ request, requestJson });
}

module.exports = { HttpClientError, createHttpClient };
