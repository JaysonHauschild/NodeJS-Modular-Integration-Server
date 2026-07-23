'use strict';

const { randomUUID } = require('node:crypto');

function requestContext(request, response, next) {
  request.id = request.get('x-request-id') || randomUUID();
  response.set('x-request-id', request.id);
  next();
}

module.exports = { requestContext };
