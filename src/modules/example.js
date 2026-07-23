'use strict';

const express = require('express');

function createExampleModule() {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.json({ integration: 'example', status: 'ready' });
  });

  return { name: 'example', mountPath: '/api/example', router };
}

module.exports = { createExampleModule };
