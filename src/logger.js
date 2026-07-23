'use strict';

const SENSITIVE_FIELD = /(?:api[-_]?key|authorization|password|secret|token|cookie)/i;

function redact(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redact(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_FIELD.test(key) ? '[REDACTED]' : redact(item, seen),
    ]),
  );
}

function write(level, name, message, fields = {}) {
  const safeFields = redact(fields);
  const details = Object.keys(safeFields).length > 0 ? ` ${JSON.stringify(safeFields)}` : '';
  const output = `[${level.toUpperCase()}] ${name} ${message}${details}`;
  (level === 'error' ? console.error : console.log)(output);
}

function createLogger(defaultFields = {}) {
  const name = defaultFields.integration || defaultFields.service || 'server';
  const contextFields = Object.fromEntries(
    Object.entries(defaultFields).filter(([key]) => key !== 'integration' && key !== 'service'),
  );

  return {
    info: (message, fields) => write('info', name, message, { ...contextFields, ...fields }),
    error: (message, fields) => write('error', name, message, { ...contextFields, ...fields }),
    child: (fields) => createLogger({ ...defaultFields, ...fields }),
  };
}

module.exports = { createLogger, redact };
