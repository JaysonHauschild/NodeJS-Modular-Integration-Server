# Node.js Modular Integration Server

A small, production-minded Express foundation for hosting independent service integrations.

## Getting started

Requires Node.js 20.12 or newer.

```bash
npm install
cp .env.example .env
npm start
```

The server listens at `http://localhost:3000`. Useful endpoints:

- `GET /health` — liveness, uptime, and enabled modules
- `GET /api/example` — example integration response
- 'GET /api/openweather/weather - Gets current weather data from a city when a city name is specified in ?city

## Architecture

Every integration lives under `src/modules` and exports a module definition:

```js
const express = require('express');

function createMyIntegration() {
  const router = express.Router();
  router.get('/', (_request, response) => response.json({ ok: true }));

  return {
    name: 'my-integration',
    mountPath: '/api/my-integration',
    router,
    async initialize(context) {},
    async shutdown(context) {},
  };
}
```

Register its factory in `src/modules/index.js`. Hooks receive a frozen `ModuleContext`. Module definitions are validated at startup, and initialized modules are shut down in reverse order.

## Module context

The registry creates a separate `ModuleContext` for every module and passes the same instance to its `initialize` and `shutdown` hooks. It exposes only the supported server capabilities:

```js
async initialize(context) {
  context.moduleName;  // this module's registered name
  context.config;      // validated, read-only server configuration
  context.logger;      // logger labeled with this module's name
  context.apiKeys;     // secure API-key handler
  context.httpClient;  // shared outbound HTTP client
}
```

Internal registry and server methods are not placed on this object, and the context cannot be extended or reassigned. This is an API boundary for integrations, not a security sandbox: installed Node.js modules still execute in the server process and should be treated as trusted code.

## API keys

Keep credentials in environment variables or inject them through your deployment platform's secret manager. Never commit them; `.env` files are ignored by Git and loaded automatically for local development. Existing process environment values take precedence over `.env`.

```env
MY_SERVICE_API_KEY=your-secret-value
```

Read a required key during module initialization and retain it only inside the module closure:

```js
function createMyIntegration() {
  let authorizationHeaders;

  return {
    name: 'my-integration',
    mountPath: '/api/my-integration',
    router,
    async initialize({ apiKeys }) {
      authorizationHeaders = apiKeys.authorizationHeaders('MY_SERVICE_API_KEY');
    },
    async shutdown() {
      authorizationHeaders = undefined;
    },
  };
}
```

Pass the returned headers directly to `fetch`. `apiKeys.get(name)` is available for providers that use query parameters or custom headers, while `apiKeys.matches(name, candidate)` performs timing-safe validation for inbound keys. Use `get(name, { required: false })` for optional integrations. Secret-shaped logger fields such as `apiKey`, `authorization`, `token`, and `password` are automatically redacted.

## Shared HTTP client

Integrations receive an HTTP client that adds request IDs, applies timeouts, normalizes upstream errors, safely logs requests without query strings, and retries transient failures for idempotent methods (`GET`, `HEAD`, `OPTIONS`, `PUT`, and `DELETE`).

```js
async initialize({ httpClient }) {
  const result = await httpClient.requestJson('https://api.example.com/items', {
    apiKey: { name: 'MY_SERVICE_API_KEY' },
    timeoutMs: 5_000,
  });
}
```

Use `apiKey: { name, header: 'x-api-key', prefix: '' }` for a custom key header. `requestJson` accepts a `json` option and serializes it with the correct content type. `POST` and `PATCH` requests are not retried by default because replaying them may duplicate side effects; set `retryUnsafeMethods: true` only when the provider supports idempotency keys.

Failed requests throw `HttpClientError` with `code`, `status`, `requestId`, and `retryable` fields. Supported options include `retries` and `timeoutMs`; their server defaults are controlled by `INTEGRATION_HTTP_RETRIES` and `INTEGRATION_HTTP_TIMEOUT_MS`. Responses are returned as standard Fetch API `Response` objects by `request`.

## Commands

```bash
npm run dev    # restart on source changes
npm test       # run the built-in Node test suite
npm run check  # syntax-check the entry point
```

Configuration is read from environment variables; see `.env.example`. Requests receive an `x-request-id` header, JSON body size is limited, unknown routes return JSON, and errors are normalized without exposing stack traces in production.

Console logs use a human-readable format. Server messages are labeled `integration-server`, while messages written from an integration lifecycle hook are automatically labeled with that module's name:

```text
[INFO] integration-server Server listening {"host":"0.0.0.0","port":3000,"environment":"development"}
[INFO] weather Weather synchronization completed {"items":12}
```

Additional fields remain machine-readable JSON, and credential-shaped fields are redacted.
