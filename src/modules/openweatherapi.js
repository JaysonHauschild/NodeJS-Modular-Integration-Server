'use strict';

const express = require('express');

function createOpenWeatherApiModule() {
  const router = express.Router();
  let httpClient;

  router.get('/weather', async (request, response, next) => {
    try {
      const weather = await httpClient.requestJson(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(request.query.city)}`,
        {
          apiKey: {
            name: 'OPENWEATHER_API_KEY',
            header: 'x-api-key',
            prefix: '',
          },
        },
      );

      response.json(weather);
    } catch (error) {
      next(error);
    }
  });

  return {
    name: 'openweather',
    mountPath: '/api/openweather',
    router,

    initialize(context) {
      httpClient = context.httpClient;
    },

    shutdown() {
      httpClient = undefined;
    },
  };
}

module.exports = { createOpenWeatherApiModule };