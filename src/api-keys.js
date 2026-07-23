'use strict';

const { createHash, timingSafeEqual } = require('node:crypto');

const VALID_NAME = /^[A-Z][A-Z0-9_]*$/;
const VALID_SCHEME = /^[A-Za-z][A-Za-z0-9._~-]*$/;

class ApiKeyError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ApiKeyError';
    this.code = code;
  }
}

function validateName(name) {
  if (typeof name !== 'string' || !VALID_NAME.test(name)) {
    throw new ApiKeyError(
      'API key names must use uppercase letters, numbers, and underscores',
      'INVALID_API_KEY_NAME',
    );
  }
}

function validateValue(value, name) {
  if (typeof value !== 'string' || value.length === 0 || /[\u0000-\u001F\u007F]/.test(value)) {
    throw new ApiKeyError(`API key ${name} is empty or contains control characters`, 'INVALID_API_KEY');
  }
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

class ApiKeyStore {
  #environment;
  #cache = new Map();

  constructor({ environment = process.env } = {}) {
    this.#environment = environment;
  }

  has(name) {
    validateName(name);
    const value = this.#environment[name];
    return typeof value === 'string' && value.length > 0;
  }

  get(name, { required = true } = {}) {
    validateName(name);
    if (this.#cache.has(name)) return this.#cache.get(name);

    const value = this.#environment[name];
    if (value === undefined || value === '') {
      if (!required) return undefined;
      throw new ApiKeyError(`Required API key ${name} is not configured`, 'API_KEY_MISSING');
    }

    validateValue(value, name);
    this.#cache.set(name, value);
    return value;
  }

  authorizationHeaders(name, { scheme = 'Bearer' } = {}) {
    if (!VALID_SCHEME.test(scheme)) {
      throw new ApiKeyError('Invalid authorization scheme', 'INVALID_AUTH_SCHEME');
    }
    return Object.freeze({ authorization: `${scheme} ${this.get(name)}` });
  }

  matches(name, candidate) {
    if (typeof candidate !== 'string') return false;
    return timingSafeEqual(digest(this.get(name)), digest(candidate));
  }

  clear() {
    this.#cache.clear();
  }
}

function createApiKeyStore(options) {
  return new ApiKeyStore(options);
}

module.exports = { ApiKeyError, ApiKeyStore, createApiKeyStore };
