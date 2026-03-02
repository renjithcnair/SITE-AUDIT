/**
 * Minimal MCP provider shim.
 * This intentionally fails fast when selected without a configured integration.
 */
function getMcpProvider() {
  const endpoint = process.env.MCP_ENDPOINT;
  const lighthouseTool = process.env.MCP_LIGHTHOUSE_TOOL;
  const accessibilityTool = process.env.MCP_ACCESSIBILITY_TOOL;

  if (!endpoint || !lighthouseTool || !accessibilityTool) {
    throw new Error(
      'MCP provider selected, but MCP_ENDPOINT, MCP_LIGHTHOUSE_TOOL, and MCP_ACCESSIBILITY_TOOL are required. ' +
      'Set SCANNER_PROVIDER=local or configure MCP environment variables.'
    );
  }

  const callTool = async () => {
    throw new Error('MCP tool invocation is not implemented in this local build. Use SCANNER_PROVIDER=local.');
  };

  return {
    name: 'mcp',
    runLighthouse: callTool,
    runAccessibility: callTool
  };
}

module.exports = {
  getMcpProvider
};
