'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var debug = require('debug')('tc-wrapper:TCfilterParser');

var FilterMatchIdIpv4 = {
  INCOMING_NETWORK: 12,
  OUTGOING_NETWORK: 16,
  PORT: 20
};
/*
const FilterMatchIdIpv6 = {
  INCOMING_NETWORK_LIST: [8, 12, 16, 20],
  OUTGOING_NETWORK_LIST: [24, 28, 32, 36],
  PORT: 40
};
*/

var TCfilterParser = function () {
  function TCfilterParser(device) {
    var ipv = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;

    _classCallCheck(this, TCfilterParser);

    this.device = device;
    this.parsedData = [];
    this.ipv = ipv;

    this._clear();
  }

  _createClass(TCfilterParser, [{
    key: 'parse',
    value: function parse() {
      var _this = this;

      return _helpers2.default.execCmd('tc filter show dev ' + this.device, [new RegExp('Cannot find device', 'i')]).then(function (stdout) {
        var strippedOut = stdout.trim().match(/[^\r\n]+/g) || [];

        strippedOut.forEach(function (line) {
          if (!line || line.length < 1) {
            return;
          }
          // Crap state machine to be able to parse multi line rules (blahblah flowid \n match blahblah). TODO: Improve
          var tcFilter = _this._getFilter();

          if (_this._parseFlowId(line)) {
            debug('Success to parse flowid on line: ' + line);
            if (tcFilter.flowid) {
              _this.parsedData.push(tcFilter);
              _this._clear();
              _this._parseFlowId(line);
            }
            return;
          }

          if (_this._parseProtocol(line)) {
            debug('Success to parse protocol on line: ' + line);
            return;
          }
          if (_this.ipv === 4) {
            _this._parseFilterIPv4(line);
          } else {
            throw new Error('IPv6 not supported yet... :(');
          }
        });

        if (_this._flowId) {
          _this.parsedData.push(_this._getFilter());
        }
        return _this.parsedData;
      });
    }
  }, {
    key: '_clear',
    value: function _clear() {
      this._flowId = null;
      this._filterSrcNetwork = null;
      this._filterDstNetwork = null;
      this._filterSrcPort = null;
      this._filterDstPort = null;
    }
  }, {
    key: '_getFilter',
    value: function _getFilter() {
      return {
        flowid: this._flowId,
        srcNetwork: this._filterSrcNetwork,
        dstNetwork: this._filterDstNetwork,
        srcPort: this._filterSrcPort,
        dstPort: this._filterDstPort,
        protocol: this._protocol
      };
    }
  }, {
    key: '_parseFlowId',
    value: function _parseFlowId(line) {
      // Line looks like: filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
      var regex = new RegExp('.*(flowid)\\s+([\\w\\:]+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return false;
      } // Not our line...

      this._flowId = parsedLine[2];
      return true;
    }
  }, {
    key: '_parseProtocol',
    value: function _parseProtocol(line) {
      // Line looks like: filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      var regex = new RegExp('.*(protocol)\\s+([\\w]+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return false;
      } // Not our line...

      this._protocol = parsedLine[2];
      return true;
    }
  }, {
    key: '_parseFilterMatchLine',
    value: function _parseFilterMatchLine(line) {
      // eslint-disable-line class-methods-use-this
      // Line looks like:  match c0a80101/ffffffff at 16
      var regex = new RegExp('.*match\\s+(\\w+)\\/(\\w+)\\s+at\\s+(\\w+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return false;
      } // Not our line...

      return { valueHex: parsedLine[1], maskHex: parsedLine[2], matchId: parseInt(parsedLine[3], 10) };
    }
  }, {
    key: '_parseFilterIPv4',
    value: function _parseFilterIPv4(line) {
      var parsedMatchLine = this._parseFilterMatchLine(line);
      if (!parsedMatchLine) {
        return false;
      } // Not our line...

      var valueHex = parsedMatchLine.valueHex,
          maskHex = parsedMatchLine.maskHex,
          matchId = parsedMatchLine.matchId;


      if (FilterMatchIdIpv4.INCOMING_NETWORK === matchId || FilterMatchIdIpv4.OUTGOING_NETWORK === matchId) {
        // IPs v4 are easy, 4 sets of 2 hex digits, netmasks are 8 hex digits, translate both to dec. Out ex: 0.0.0.0/32
        var ip = valueHex.match(/.{2}/g).map(function (set) {
          return parseInt(set, 16);
        }).join('.');
        var netmask = ((parseInt(maskHex, 16) >>> 0).toString(2).match(/1/g) || []).length; // eslint-disable-line no-bitwise

        if (FilterMatchIdIpv4.INCOMING_NETWORK === matchId) {
          this._filterSrcNetwork = ip + '/' + netmask;
        } else {
          this._filterDstNetwork = ip + '/' + netmask;
        }
      } else if (matchId === FilterMatchIdIpv4.PORT) {
        // Ports are eight hex digits, upper-half represents src port and the bottom-half represents dst port
        this._filterSrcPort = parseInt(valueHex.substring(0, 4), 16) || null;
        this._filterDstPort = parseInt(valueHex.substring(4, 8), 16) || null;
      }

      return true;
    }
  }]);

  return TCfilterParser;
}();

exports.default = TCfilterParser;