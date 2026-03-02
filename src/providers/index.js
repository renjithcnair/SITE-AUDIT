const { getLocalProvider } = require('./localProvider');
const { getMcpProvider } = require('./mcpProvider');

function resolveScannerProvider() {
  const provider = (process.env.SCANNER_PROVIDER || 'local').toLowerCase();

  if (provider === 'local') {
    return getLocalProvider();
  }

  if (provider === 'mcp') {
    return getMcpProvider();
  }

  throw new Error(`Unknown scanner provider: ${provider}. Supported providers: local, mcp.`);
}

module.exports = {
  resolveScannerProvider
};
