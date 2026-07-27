'use strict';

const { createExampleModule } = require('./example');
const { createHealthModule } = require('./health');
const { createOpenWeatherApiModule } = require('./openweatherapi');

function createDefaultModules() {
  const integrations = [createExampleModule(), createOpenWeatherApiModule()];
  const health = createHealthModule({ moduleNames: integrations.map(({ name }) => name) });
  return [health, ...integrations];
}

module.exports = { createDefaultModules };
