'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _os = require('os');

var _os2 = _interopRequireDefault(_os);

var _childProcessEs6Promise = require('child-process-es6-promise');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var debug = require('debug')('tc-wrapper');

// Does a network iface exists?
function checkNetworkIface(iface) {
  return _os2.default.networkInterfaces()[iface] !== undefined;
}

// Helper function to exec commands.
function execCmd(cmd) {
  var allowedErrors = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  debug('About to execute cmd: ' + cmd + ' with allowed errors: ' + JSON.stringify(allowedErrors));
  return (0, _childProcessEs6Promise.exec)(cmd, {}).then(function (result) {
    debug('Executed successfully cmd: ' + cmd + ': ', result.stdout);
    var stdout = result.stdout;

    return stdout;
  }).catch(function (error) {
    debug('Executed with error cmd: ' + cmd + ': ', error.stdout, error.stderr);
    if (allowedErrors.some(function (allowedError) {
      return allowedError.test(error.stderr);
    })) {
      return Promise.resolve(error.stderr);
    }
    return Promise.reject(error);
  });
}

exports.default = { checkNetworkIface: checkNetworkIface, execCmd: execCmd };