'use strict';

const { ModuleContext } = require('./module-context');

function validateModule(module, names, paths) {
  if (!module || typeof module !== 'object') throw new TypeError('A module must be an object');
  if (!module.name || typeof module.name !== 'string') throw new TypeError('A module requires a name');
  if (!module.mountPath?.startsWith('/')) throw new TypeError(`Module ${module.name} requires an absolute mountPath`);
  if (typeof module.router !== 'function') throw new TypeError(`Module ${module.name} requires an Express router`);
  if (names.has(module.name)) throw new Error(`Duplicate module name: ${module.name}`);
  if (paths.has(module.mountPath)) throw new Error(`Duplicate module mountPath: ${module.mountPath}`);
  names.add(module.name);
  paths.add(module.mountPath);
}

function createModuleRegistry(modules, serverServices) {
  const initialized = [];
  const names = new Set();
  const paths = new Set();
  modules.forEach((module) => validateModule(module, names, paths));

  return {
    mount(app) {
      for (const module of modules) app.use(module.mountPath, module.router);
    },
    async initialize() {
      try {
        for (const module of modules) {
          const moduleContext = new ModuleContext({
            moduleName: module.name,
            config: serverServices.config,
            logger: serverServices.logger.child?.({ integration: module.name }) || serverServices.logger,
            apiKeys: serverServices.apiKeys,
            httpClient: serverServices.httpClient,
            events: serverServices.eventBus.forModule(module.name),
          });
          await module.initialize?.(moduleContext);
          initialized.push({ module, context: moduleContext });
          serverServices.logger.info('Module initialized', {
            module: module.name,
            mountPath: module.mountPath,
          });
        }
      } catch (error) {
        await this.shutdown();
        throw error;
      }
    },
    async shutdown() {
      for (const initializedModule of initialized.reverse()) {
        const { module, context: moduleContext } = initializedModule;
        try {
          await module.shutdown?.(moduleContext);
        } catch (error) {
          serverServices.logger.error('Module shutdown failed', {
            module: module.name,
            error: error.message,
          });
        }
        serverServices.eventBus.removeModule(module.name);
      }
      initialized.length = 0;
      serverServices.apiKeys.clear();
      serverServices.eventBus.clear();
    },
  };
}

module.exports = { createModuleRegistry };
