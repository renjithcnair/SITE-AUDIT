const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const { JobStore } = require('./jobStore');
const { createScanController } = require('./scanController');
const { createRouter } = require('./routes');

function createApp(options = {}) {
  const app = express();
  const jobStore = options.jobStore || new JobStore();
  const reportDir = options.reportDir || path.resolve(process.cwd(), 'reports');

  app.use(express.json({ limit: '1mb' }));

  const controller = createScanController({
    jobStore,
    reportDir
  });

  createRouter(app, controller);

  const webDist = options.webDist || path.resolve(process.cwd(), 'web', 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}

module.exports = {
  createApp
};
