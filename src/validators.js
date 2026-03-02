/**
 * Validates and parses the user-provided target URL.
 * @param {string} input
 * @returns {URL}
 */
function parseTargetUrl(input) {
  let parsed;

  try {
    parsed = new URL(input);
  } catch {
    throw new Error('Input must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL protocol must be http or https.');
  }

  return parsed;
}

module.exports = {
  parseTargetUrl
};
