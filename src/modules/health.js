'use strict';

const express = require('express');

function createHealthModule({ moduleNames = [] } = {}) {
  const router = express.Router();

  router.get('/', (_request, response) => {
    response.json({
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      modules: moduleNames,
    });
  });

  return { name: 'health', mountPath: '/health', router };
}

module.exports = { createHealthModule };
