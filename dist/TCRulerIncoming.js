'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var debug = require('debug')('tc-wrapper:TCRulerIncoming');

var DEFAULT_CLASS_MINOR_ID = 1;

var TCRulerIncoming = function () {
  function TCRulerIncoming(device, deviceQdiscMajorId, dstNetwork, srcNetwork, protocol, dstPort, srcPort, options) {
    var qdiscMinorId = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : DEFAULT_CLASS_MINOR_ID;
    var netemMajorId = arguments[9];

    _classCallCheck(this, TCRulerIncoming);

    this.device = device;
    this.deviceQdiscMajorId = deviceQdiscMajorId;
    this.dstNetwork = dstNetwork;
    this.srcNetwork = srcNetwork;
    this.protocol = protocol;
    this.dstPort = dstPort;
    this.srcPort = srcPort;

    this.options = options;

    // Rules counters...
    this.qdiscMinorId = qdiscMinorId;
    this.netemMajorId = netemMajorId;

    this._getMaxRate();
  }

  _createClass(TCRulerIncoming, [{
    key: '_genMakeNetemQdiscCmd',
    value: function _genMakeNetemQdiscCmd() {
      return {
        cmd: 'tc qdisc add dev ' + this.device + ' parent ' + this.deviceQdiscMajorId + ':' + this.qdiscMinorId + ' handle 1111: netem',
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };
    }

    // TODO: Convert to async...

  }, {
    key: '_getMaxRate',
    value: function _getMaxRate() {
      // Max default rate of linux kernel is 32G, lets see if we can get the iface limit.
      var maxRate = '32Gbit';
      try {
        var ifaceLimit = _fs2.default.readFileSync('/sys/class/net/' + this.device + '/speed', 'utf8');
        this.deviceMaxRate = ifaceLimit.match(/(\d+)/)[1] + 'Mbit';
        return;
      } catch (e) {/* ignored */}

      this.deviceMaxRate = maxRate;
    }
  }, {
    key: '_genRateCmd',
    value: function _genRateCmd() {
      var customRate = this.options.rate !== undefined;
      var rateStr = customRate ? this.options.rate : this.deviceMaxRate;
      return {
        // TODO: calculate buffer and limit according to rate
        cmd: 'tc qdisc add dev ' + this.device + ' parent 1111:' + this.qdiscMinorId + ' handle 20: tbf ' + ('rate ' + rateStr + ' buffer 30000 limit 10000'),
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };
    }
  }, {
    key: '_genAddFilterCmd',
    value: function _genAddFilterCmd() {
      var cmd = {
        cmd: 'tc filter add dev ' + this.device + ' protocol ' + this.protocol + ' parent ' + this.deviceQdiscMajorId + ': prio 2 u32',
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };

      if (this.srcNetwork !== null) {
        cmd.cmd += ' match ' + this.protocol + ' src ' + this.srcNetwork;
      }

      if (this.dstNetwork !== null) {
        cmd.cmd += ' match ' + this.protocol + ' dst ' + this.dstNetwork;
      }

      if (this.srcPort !== null) {
        cmd.cmd += ' match ' + this.protocol + ' sport ' + this.srcPort + ' 0xffff';
      }
      if (this.dstPort !== null) {
        cmd.cmd += ' match ' + this.protocol + ' dport ' + this.dstPort + ' 0xffff';
      }

      cmd.cmd += ' flowid ' + this.deviceQdiscMajorId + ':' + this.qdiscMinorId;
      return cmd;
    }
  }, {
    key: 'genRulesCmds',
    value: function genRulesCmds() {
      var cmds = [];

      cmds.push(this._genMakeNetemQdiscCmd());
      cmds.push(this._genRateCmd());
      cmds.push(this._genAddFilterCmd());
      debug('TC Rules cmds generated:\n' + cmds.map(function (cmd) {
        return '   ' + cmd.cmd + '\n';
      }).join(''));
      return cmds;
    }
  }, {
    key: 'executeRules',
    value: function executeRules() {
      return _bluebird2.default.mapSeries(this.genRulesCmds(), function (cmd) {
        return _helpers2.default.execCmd(cmd.cmd, cmd.allowedErrors);
      });
    }
  }]);

  return TCRulerIncoming;
}();

exports.default = TCRulerIncoming;