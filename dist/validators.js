'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// Only ipv4 supported right now. TODO: Support v6
var ipv4RulePattern = /^((dst|src)Network=(\d{1,3}\.){3}\d{1,3}\/\d{1,2},){1,2}(srcPort=\d+,)?(dstPort=\d+,)?protocol=ip$/;

// TODO: Improve validation!
exports.default = {
  setRules: _joi2.default.object({
    outgoing: _joi2.default.object().pattern(ipv4RulePattern, _joi2.default.object({
      rate: _joi2.default.string(),
      delay: _joi2.default.string(),
      jitter: _joi2.default.string(),
      loss: _joi2.default.string(),
      corrupt: _joi2.default.string()
    })),
    incoming: _joi2.default.object().pattern(ipv4RulePattern, _joi2.default.object({
      rate: _joi2.default.string(),
      delay: _joi2.default.string(),
      jitter: _joi2.default.string(),
      loss: _joi2.default.string(),
      corrupt: _joi2.default.string()
    }))
  }).unknown(false).required()
};