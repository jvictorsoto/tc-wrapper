'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TCclassParser = function () {
  function TCclassParser(device) {
    _classCallCheck(this, TCclassParser);

    this.device = device;
    this.parsedParams = [];
    this._clear();
  }

  _createClass(TCclassParser, [{
    key: 'parse',
    value: function parse() {
      var _this = this;

      return _helpers2.default.execCmd('tc class show dev ' + this.device, [new RegExp('Cannot find device', 'i')]).then(function (stdout) {
        var strippedOut = stdout.trim().match(/[^\r\n]+/g) || [];

        strippedOut.forEach(function (line) {
          if (!line || line.length < 1) {
            return;
          }

          _this._parseClassId(line);
          _this._parseHtbRate(line);

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
    key: '_parseClassId',
    value: function _parseClassId(line) {
      // Line looks like: class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b
      var regex = new RegExp('.*(class htb)\\s+([\\w\\:]+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return;
      } // Not our line...

      this.parsedParam.classid = parsedLine[2];
    }
  }, {
    key: '_parseHtbRate',
    value: function _parseHtbRate(line) {
      // Line looks like: class htb 1a37:2 root leaf 1ab7: prio 0 rate 20Mbit ceil 20Mbit burst 250Kb cburst 250Kb
      var regex = new RegExp('.*(rate)\\s+(\\d+\\w+).*');
      var parsedLine = line.match(regex);
      if (parsedLine === null) {
        return;
      } // Not our line...

      this.parsedParam.rate = parsedLine[2];
    }
  }]);

  return TCclassParser;
}();

exports.default = TCclassParser;