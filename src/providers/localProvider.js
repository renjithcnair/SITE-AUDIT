const { runLighthouse } = require('../lighthouseRunner');
const { runAccessibility } = require('../accessibilityRunner');

function getLocalProvider() {
  return {
    name: 'local',
    runLighthouse,
    runAccessibility
  };
}

module.exports = {
  getLocalProvider
};
