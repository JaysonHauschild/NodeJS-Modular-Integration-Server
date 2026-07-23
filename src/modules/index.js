'use strict';

const { createExampleModule } = require('./example');
const { createHealthModule } = require('./health');
const { createOpenWeatherApiModule } = require('./openweatherapi');

function createDefaultModules() {
  const integrations = [createExampleModule()];
  const health = createHealthModule({ moduleNames: integrations.map(({ name }) => name) });
  const openWeatherApiModule = createOpenWeatherApiModule({ apiKey: process.env.OPENWEATHER_API_KEY, moduleNames: integrations.map(({ name }) => name) });
  return [health, ...integrations, openWeatherApiModule];
}

module.exports = { createDefaultModules };
