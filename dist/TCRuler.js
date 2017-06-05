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

var debug = require('debug')('tc-wrapper:TCRuler');

var DEFAULT_CLASS_MINOR_ID = 1;

// Only supports htb shapping...

var TCRuler = function () {
  function TCRuler(device, deviceQdiscMajorId, direction, network, protocol, dstPort, srcPort, options) {
    var qdiscMinorId = arguments.length > 8 && arguments[8] !== undefined ? arguments[8] : DEFAULT_CLASS_MINOR_ID;
    var netemMajorId = arguments[9];

    _classCallCheck(this, TCRuler);

    this.device = device;
    this.deviceQdiscMajorId = deviceQdiscMajorId;
    this.direction = direction;
    this.network = network;
    this.protocol = protocol;
    this.dstPort = dstPort;
    this.srcPort = srcPort;

    this.options = options;

    // Rules counters...
    this.qdiscMinorId = qdiscMinorId;
    this.netemMajorId = netemMajorId;

    this._getMaxRate();
  }

  _createClass(TCRuler, [{
    key: '_genMakeQdiscCmd',
    value: function _genMakeQdiscCmd() {
      return {
        cmd: 'tc qdisc add dev ' + this.device + ' root handle ' + this.deviceQdiscMajorId + ': htb ' + ('default ' + DEFAULT_CLASS_MINOR_ID),
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };
    }
  }, {
    key: '_getQdiscMinorId',
    value: function _getQdiscMinorId() {
      return ++this.qdiscMinorId; // eslint-disable-line no-plusplus
    }
  }, {
    key: '_getNetemMajorId',
    value: function _getNetemMajorId() {
      if (this.netemMajorId === undefined || this.netemMajorId === null) {
        this.netemMajorId = (parseInt(this.deviceQdiscMajorId, 16) + 128).toString(16);
      } else {
        this.netemMajorId = (parseInt(this.netemMajorId, 16) + 1).toString(16);
      }

      return this.netemMajorId;
    }

    // TODO: Convert to async...

  }, {
    key: '_getMaxRate',
    value: function _getMaxRate() {
      // Max default rate of linux kernel is 32G, lets see if we can get the iface limit.
      var maxRate = '32Gbit';
      try {
        var ifaceLimit = _fs2.default.readFileSync('/sys/class/net/enp2s0sd/speed', 'utf8');
        this.deviceMaxRate = ifaceLimit.match(/(\d+)/)[1] + 'Mbit';
      } catch (e) {/* ignored */}

      this.deviceMaxRate = maxRate;
    }
  }, {
    key: '_genDefaultClass',
    value: function _genDefaultClass() {
      return {
        cmd: 'tc class add dev ' + this.device + ' parent ' + this.deviceQdiscMajorId + ': classid ' + this.deviceQdiscMajorId + ':' + (DEFAULT_CLASS_MINOR_ID + ' htb rate ' + this.deviceMaxRate),
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };
    }
  }, {
    key: '_genRateCmd',
    value: function _genRateCmd() {
      var customRate = this.options.rate !== undefined;
      var cmd = {
        cmd: 'tc class add dev ' + this.device + ' parent ' + this.deviceQdiscMajorId + ': classid ' + this.deviceQdiscMajorId + ':' + (this._getQdiscMinorId() + ' htb rate ' + (customRate ? this.options.rate : this.deviceMaxRate) + ' ') + ('ceil ' + (customRate ? this.options.rate : this.deviceMaxRate)),
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };

      if (customRate) {
        var rate = parseInt(this.options.rate.match(/(\d+)(\w+)/)[1], 10);
        var rateUnit = this.options.rate.match(/(\d+)(\w+)/)[2];
        // Default values of burst and cburst, needed on custom rate.
        var burstRate = rate / (10 * 8);
        var cburstRate = rate / (10 * 8);
        cmd.cmd += ' burst ' + burstRate + rateUnit + ' cburst ' + cburstRate + rateUnit;
      }

      return cmd;
    }
  }, {
    key: '_genSetNetemCmd',
    value: function _genSetNetemCmd() {
      var cmd = {
        cmd: 'tc qdisc add dev ' + this.device + ' parent ' + this.deviceQdiscMajorId + ':' + this.qdiscMinorId + ' ' + ('handle ' + this._getNetemMajorId() + ': netem'),
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };

      if (this.options.loss !== undefined) {
        cmd.cmd += ' loss ' + this.options.loss;
      }

      if (this.options.delay !== undefined) {
        cmd.cmd += ' delay ' + this.options.delay;
      }

      if (this.options.delay !== undefined && this.options.jitter !== undefined) {
        cmd.cmd += ' ' + this.options.jitter + ' distribution normal';
      }

      if (this.options.corrupt !== undefined) {
        cmd.cmd += ' corrupt ' + this.options.corrupt;
      }
      return cmd;
    }
  }, {
    key: '_genAddFilterCmd',
    value: function _genAddFilterCmd() {
      var cmd = {
        cmd: 'tc filter add dev ' + this.device + ' protocol ip parent ' + this.deviceQdiscMajorId + ': prio 1 ' + ('u32 match ' + this.protocol + ' ' + (this.direction === 'outgoing' ? 'dst' : 'src') + ' ' + this.network),
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      };

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
      cmds.push(this._genMakeQdiscCmd());
      cmds.push(this._genDefaultClass());
      cmds.push(this._genRateCmd());
      cmds.push(this._genSetNetemCmd());
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

  return TCRuler;
}();

exports.default = TCRuler;