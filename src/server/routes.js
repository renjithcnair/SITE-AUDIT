function createRouter(app, controller) {
  app.post('/api/scans', controller.startScan);
  app.get('/api/scans/:scanId', controller.getScan);
  app.get('/api/scans/:scanId/events', controller.scanEvents);
  app.post('/api/scans/:scanId/pause', controller.pauseScan);
  app.post('/api/scans/:scanId/resume', controller.resumeScan);
  app.post('/api/scans/:scanId/stop', controller.stopScan);
  app.post('/api/scans/:scanId/restart', controller.restartScan);
  app.post('/api/scans/:scanId/clear', controller.clearScanView);
  app.get('/api/scans/:scanId/report.json', controller.downloadJsonReport);
  app.get('/api/scans/:scanId/report.md', controller.downloadMarkdownReport);
}

module.exports = {
  createRouter
};
