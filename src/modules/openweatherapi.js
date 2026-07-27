'use strict';

const express = require('express');

function createOpenWeatherApiModule() {
  const router = express.Router();
  let apiKey;
  let events;
  let httpClient;

  const poorConditions = new Set(['Thunderstorm', 'Drizzle', 'Rain', 'Snow', 'Squall', 'Tornado']);

  router.get('/weather', async (request, response, next) => {
    try {
      const city = request.query.city?.trim();
      if (!city) return response.status(400).json({ error: 'City is required' });

      const url = new URL('https://api.openweathermap.org/data/2.5/weather');
      url.searchParams.set('q', city);
      url.searchParams.set('appid', apiKey);
      const weather = await httpClient.requestJson(
        url,
      );

      const conditions = (weather.weather || []).map(({ main }) => main);
      if (conditions.some((condition) => poorConditions.has(condition))) {
        await events.emit('openweather:bad-weather', {
          city: weather.name || city,
          conditions,
        });
      }

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
      apiKey = context.apiKeys.get('OPENWEATHER_API_KEY');
      httpClient = context.httpClient;
      events = context.events;
      events.create('openweather:bad-weather');
    },

    shutdown() {
      apiKey = undefined;
      events = undefined;
      httpClient = undefined;
    },
  };
}

module.exports = { createOpenWeatherApiModule };
