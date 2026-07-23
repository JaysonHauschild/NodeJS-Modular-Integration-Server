'use strict';

const { HttpError } = require('../errors');

function notFound(request, _response, next) {
  next(new HttpError(404, `Route ${request.method} ${request.path} not found`));
}

function errorHandler(error, request, response, _next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const message = status >= 500 ? 'Internal server error' : error.message;

  request.logger?.error('Request failed', {
    requestId: request.id,
    method: request.method,
    path: request.originalUrl,
    status,
    error: error.message,
  });

  const body = { error: { message, requestId: request.id } };
  if (error.details !== undefined && status < 500) body.error.details = error.details;
  response.status(status).json(body);
}

module.exports = { notFound, errorHandler };
