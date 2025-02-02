const fs = require('fs');
const path = require('path');

const injectedScript = fs.readFileSync(path.resolve(__dirname, 'injected-code.js')).toString();

function getInjectionJs() {
  return injectedScript;
}

module.exports = getInjectionJs;
