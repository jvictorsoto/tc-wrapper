import os from 'os';
import { exec } from 'child-process-es6-promise';

const debug = require('debug')('tc-wrapper');

// Does a network iface exists?
function checkNetworkIface(iface) {
  return os.networkInterfaces()[iface] !== undefined;
}

// Helper function to exec commands.
function execCmd(cmd, allowedErrors = []) {
  debug(`About to execute cmd: ${cmd} with allowed errors: ${JSON.stringify(allowedErrors)}`);
  return exec(cmd, {})
    .then((result) => {
      debug(`Executed successfully cmd: ${cmd}: `, result.stdout);
      const { stdout } = result;
      return stdout;
    })
    .catch((error) => {
      debug(`Executed with error cmd: ${cmd}: `, error.stdout, error.stderr);
      if (allowedErrors.some(allowedError => allowedError.test(error.stderr))) {
        return Promise.resolve(error.stderr);
      }
      return Promise.reject(error);
    });
}

export default { checkNetworkIface, execCmd };
