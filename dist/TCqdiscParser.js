'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TCqdiscParser = function () {
  function TCqdiscParser(device) {
    _classCallCheck(this, TCqdiscParser);

    this.device = device;
    this.parsedParams = [];
    this._clear();
  }

  _createClass(TCqdiscParser, [{
    key: 'parse',
    value: function parse() {
      var _this = this;

      return _helpers2.default.execCmd('tc qdisc show dev ' + this.device, [new RegExp('Cannot find device', 'i')]).then(function (stdout) {
        var strippedOut = stdout.trim().match(/[^\r\n]+/g) || [];

        strippedOut.forEach(function (line) {
          if (line.indexOf('qdisc netem') === -1 && line.indexOf('qdisc tbf') === -1) {
            return;
          }

          if (line.indexOf('qdisc netem') > -1) {
            _this._parseNetemParam(line, 'parent', '\\w+\\:\\w+');
          }

          _this._parseNetemParam(line, 'delay', '\\d+\\.\\d+\\w+');
          _this._parseNetemDelayAndJitter(line);
          _this._parseNetemParam(line, 'loss', '[\\d\\.]+\\%');
          _this._parseNetemParam(line, 'corrupt', '[\\d\\.]+\\%');
          _this._parseTbfRate(line); // TODO: Check that this works fine, I only support htb rate not tbf...

          _this.parsedParams.push(_this.parsedParam);
          _this._clear();
        });

        return _this.parsedParams;
      });
    }
  }, {
    key: '_clear',
    value: function _clear() {
      this.parsedParam = {};
    }
  }, {
    key: '_parseNetemDelayAndJitter',
    value: function _parseNetemDelayAndJitter(line) {
      // Line looks like: qdisc netem 1aba: parent 1a37:5 limit 1000 delay 20.0ms  1.5ms loss 11%
      var regex = new RegExp('.*(delay)\\s+(\\d+\\.\\d+\\w+)\\s+(\\d+\\.\\d+\\w+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return;
      } // Not our line...

      this.parsedParam.delay = parsedLine[2];
      this.parsedParam.jitter = parsedLine[3];
    }
  }, {
    key: '_parseNetemParam',
    value: function _parseNetemParam(line, parseParamName, pattern) {
      // Line looks like: qdisc netem 1aba: parent 1a37:5 limit 1000 delay 20.0ms  1.5ms loss 11%
      var regex = new RegExp('.*(' + parseParamName + ')\\s+(' + pattern + ').*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return;
      } // Not our line...

      this.parsedParam[parseParamName] = parsedLine[2];
    }
  }, {
    key: '_parseTbfRate',
    value: function _parseTbfRate(line) {
      // Line looks like:  qdisc tbf 20: parent 1a41:1 rate 20Mbit burst 20000b limit 10000b
      var regex = new RegExp('.*(rate)\\s+(\\d+\\w+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return;
      } // Not our line...

      this.parsedParam.rate = parsedLine[2];
    }
  }]);

  return TCqdiscParser;
}();

exports.default = TCqdiscParser;