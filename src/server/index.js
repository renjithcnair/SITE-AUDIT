const path = require('node:path');

const { createApp } = require('./app');
const { createLogger } = require('../logger');

const logger = createLogger('api-server');

function startServer() {
  const port = Number(process.env.PORT || 3000);
  const app = createApp({
    reportDir: path.resolve(process.cwd(), 'reports')
  });

  const server = app.listen(port, () => {
    logger.info('Site audit API running', { url: `http://localhost:${port}`, port });
  });

  server.on('error', (error) => {
    logger.fatal('API server failed to start', {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception in API process', {
      message: error instanceof Error ? error.message : String(error)
    });
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal('Unhandled promise rejection in API process', {
      reason: reason instanceof Error ? reason.message : String(reason)
    });
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
