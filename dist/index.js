'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _bluebird = require('bluebird');

var _bluebird2 = _interopRequireDefault(_bluebird);

var _md = require('md5');

var _md2 = _interopRequireDefault(_md);

var _joi = require('joi');

var _joi2 = _interopRequireDefault(_joi);

var _TCfilterParser = require('./TCfilterParser');

var _TCfilterParser2 = _interopRequireDefault(_TCfilterParser);

var _TCqdiscParser = require('./TCqdiscParser');

var _TCqdiscParser2 = _interopRequireDefault(_TCqdiscParser);

var _TCclassParser = require('./TCclassParser');

var _TCclassParser2 = _interopRequireDefault(_TCclassParser);

var _TCRuler = require('./TCRuler');

var _TCRuler2 = _interopRequireDefault(_TCRuler);

var _helpers = require('./helpers');

var _helpers2 = _interopRequireDefault(_helpers);

var _validators = require('./validators');

var _validators2 = _interopRequireDefault(_validators);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var debug = require('debug')('tc-wrapper');

var TCWrapper = function () {
  function TCWrapper(device) {
    _classCallCheck(this, TCWrapper);

    this.device = device;
    this.deviceQdiscMajorId = this._genDeviceQdiscMajorId();
    this.ifbDevice = 'ifb' + parseInt(this.deviceQdiscMajorId, 16);
    this.protocol = 'ip'; // IPv6 not suported yet, only IPv4
  }

  _createClass(TCWrapper, [{
    key: '_genDeviceQdiscMajorId',
    value: function _genDeviceQdiscMajorId() {
      var baseDeviceHash = (0, _md2.default)(this.device).substring(0, 3);
      var deviceHashPrefix = '1';
      return '' + deviceHashPrefix + baseDeviceHash;
    }
  }, {
    key: '_genFilterKey',
    value: function _genFilterKey(filterParam) {
      // eslint-disable-line class-methods-use-this
      var params = [];
      if (filterParam.srcNetwork !== null) {
        params.push('srcNetwork=' + filterParam.srcNetwork);
      }
      if (filterParam.dstNetwork !== null) {
        params.push('dstNetwork=' + filterParam.dstNetwork);
      }
      if (filterParam.srcPort !== null) {
        params.push('srcPort=' + filterParam.srcPort);
      }
      if (filterParam.dstPort !== null) {
        params.push('dstPort=' + filterParam.dstPort);
      }
      if (filterParam.protocol !== null) {
        params.push('protocol=' + filterParam.protocol);
      }

      return params.join(',');
    }
  }, {
    key: '_getShapingRule',
    value: function _getShapingRule(target) {
      var _this = this;

      var ipv = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;

      var tcFilterParser = new _TCfilterParser2.default(target, ipv);
      var tcQdiscParser = new _TCqdiscParser2.default(target, ipv);
      var tcClassParser = new _TCclassParser2.default(target, ipv);

      return _bluebird2.default.all([tcFilterParser.parse(), tcQdiscParser.parse(), tcClassParser.parse()]).then(function (results) {
        var _results = _slicedToArray(results, 3),
            filterParams = _results[0],
            qdiscParams = _results[1],
            classParams = _results[2];

        var shapingRuleMapping = {};

        filterParams.forEach(function (filterParam) {
          var shapingRule = {};

          var filterKey = _this._genFilterKey(filterParam);
          if (filterKey.length === 0) {
            return;
          }

          qdiscParams.forEach(function (qdiscParam) {
            if (qdiscParam.parent !== filterParam.flowid) {
              return;
            } // Not our qdisc

            // Clone qdisc and remove parent key as we match it in the result
            var qdiscParamClone = Object.assign({}, qdiscParam);
            delete qdiscParamClone.parent;
            Object.assign(shapingRule, qdiscParamClone);
          });

          classParams.forEach(function (classParam) {
            if (classParam.classid !== filterParam.flowid) {
              return;
            } // Not our class

            // Clone class and remove classid key as we match it in the result
            var classParamClone = Object.assign({}, classParam);
            delete classParamClone.classid;
            Object.assign(shapingRule, classParamClone);
          });

          if (!shapingRule) {
            return;
          }

          debug('rule found: ' + filterKey + ' -> ' + JSON.stringify(shapingRule));
          shapingRuleMapping[filterKey] = shapingRule;
        });

        return shapingRuleMapping;
      });
    }
  }, {
    key: 'del',
    value: function del() {
      debug('About to delete rules of iface: ' + this.device);
      var commands = [
      // Delete out qdisc
      {
        cmd: 'tc qdisc del dev ' + this.device + ' root',
        allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i'), new RegExp('Error: Cannot delete qdisc with handle of zero.', 'i')]
      },
      // Delete in qdisc
      {
        cmd: 'tc qdisc del dev ' + this.device + ' ingress',
        allowedErrors: [new RegExp('RTNETLINK answers: Invalid argument', 'i'), new RegExp('RTNETLINK answers: No such file or directory', 'i'), new RegExp('Error: Invalid handle.', 'i'), new RegExp('Error: Cannot find specified qdisc on specified device.', 'i')]
      }];

      // If ifb device is up delete it too!
      if (_helpers2.default.checkNetworkIface(this.ifbDevice)) {
        debug('ifbDevice ' + this.ifbDevice + ' present, deleting it too...');
        [{
          cmd: 'tc qdisc del dev ' + this.ifbDevice + ' root',
          allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i'), new RegExp('Error: Cannot delete qdisc with handle of zero.', 'i')]
        }, {
          cmd: 'ip link set dev ' + this.ifbDevice + ' down',
          allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i'), new RegExp('Cannot find device', 'i')]
        }, {
          cmd: 'ip link delete ' + this.ifbDevice + ' type ifb',
          allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i'), new RegExp('Cannot find device', 'i')]
        }].forEach(function (c) {
          return commands.push(c);
        });
      }

      return _bluebird2.default.mapSeries(commands, function (command) {
        debug('Running command ' + command + '...');
        return _helpers2.default.execCmd(command.cmd, command.allowedErrors).catch(function (err) {
          throw new Error('Error executing cmd: ' + command.cmd + ' with allowedErrors: ' + command.allowedErrors + ': ' + err);
        });
      });
    }
  }, {
    key: 'get',
    value: function get(ipv) {
      debug('About to fetch rules of ifaces: ' + this.device + ', ' + this.ifbDevice);
      return _bluebird2.default.all([this._getShapingRule(this.device, ipv), this._getShapingRule(this.ifbDevice, ipv)]).then(function (results) {
        var _results2 = _slicedToArray(results, 2),
            outgoing = _results2[0],
            incoming = _results2[1];

        return { outgoing: outgoing, incoming: incoming };
      });
    }
  }, {
    key: '_enableIfbDevice',
    value: function _enableIfbDevice() {
      var commands = [{ cmd: 'modprobe ifb', allowedErrors: [] }, // Check if ifb module is present in Kernel
      {
        cmd: 'ip link add ' + this.ifbDevice + ' type ifb',
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i'), new RegExp('Error: Exclusivity flag on, cannot modify.', 'i')]
      }, { cmd: 'ip link set dev ' + this.ifbDevice + ' up', allowedErrors: [] }, {
        cmd: 'tc qdisc add dev ' + this.device + ' ingress',
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i'), new RegExp('Error: Exclusivity flag on, cannot modify.', 'i')]
      }, {
        cmd: 'tc filter add dev ' + this.device + ' parent ffff: protocol ' + this.protocol + ' u32 match u32 0 0 ' + ('flowid ' + this.deviceQdiscMajorId + ': action mirred egress redirect dev ' + this.ifbDevice),
        allowedErrors: []
      }];

      return _bluebird2.default.mapSeries(commands, function (command) {
        debug('Running command ' + command + '...');
        return _helpers2.default.execCmd(command.cmd, command.allowedErrors).catch(function (err) {
          throw new Error('Error executing cmd: ' + command.cmd + ' with allowedErrors: ' + command.allowedErrors + ': ' + err);
        });
      });
    }
  }, {
    key: '_genTCRuler',
    value: function _genTCRuler(device, direction, rule, rulePayload, qdiscMinorId, netemMajorId) {
      // Mandatory rule parameters.
      var srcNetwork = null;
      var dstNetwork = null;
      try {
        srcNetwork = rule.match(/.*srcNetwork=(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}).*/)[1];
      } catch (e) {/* ignored */}

      try {
        dstNetwork = rule.match(/.*dstNetwork=(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}).*/)[1];
      } catch (e) {/* ignored */}

      var protocol = rule.match(/.*protocol=(\w+).*/)[1];

      // Optional rule parameters
      var srcPort = null;
      var dstPort = null;
      try {
        srcPort = rule.match(/.*srcPort=(\d+).*/)[1];
      } catch (e) {/* ignored */}
      try {
        dstPort = rule.match(/.*dstPort=(\d+).*/)[1];
      } catch (e) {/* ignored */}

      var tcRuler = new _TCRuler2.default(device, this.deviceQdiscMajorId, direction, dstNetwork, srcNetwork, protocol, dstPort, srcPort, rulePayload, qdiscMinorId, netemMajorId);

      return tcRuler;
    }
  }, {
    key: 'set',
    value: function set(inputRules) {
      var _this2 = this;

      var _Joi$validate = _joi2.default.validate(inputRules, _validators2.default.setRules),
          error = _Joi$validate.error,
          rules = _Joi$validate.value;

      if (error) {
        throw new Error('Rules validation error: ' + error.message);
      }

      rules.outgoing = rules.outgoing || {};
      rules.incoming = rules.incoming || {};

      var actions = [this.del];

      // Store ids for multiple ruling
      var qdiscMinorId = void 0;
      var netemMajorId = void 0;

      // Iterate over all outgoing rules and set them
      actions.push(function () {
        return _bluebird2.default.mapSeries(Object.keys(rules.outgoing), function (rule) {
          var tcRuler = _this2._genTCRuler(_this2.device, 'outgoing', rule, rules.outgoing[rule], qdiscMinorId, netemMajorId);

          return tcRuler.executeRules().then(function () {
            qdiscMinorId = tcRuler.qdiscMinorId;
            netemMajorId = tcRuler.netemMajorId;
          });
        });
      });

      if (rules.incoming && Object.keys(rules.incoming).length > 0) {
        actions.push(this._enableIfbDevice);
        // Clean ids...
        actions.push(function () {
          return new _bluebird2.default(function (resolve) {
            qdiscMinorId = undefined;
            netemMajorId = undefined;
            resolve(null);
          });
        });
      }

      // Iterate over all incoming rules and set them
      actions.push(function () {
        return _bluebird2.default.mapSeries(Object.keys(rules.incoming), function (rule) {
          var tcRuler = _this2._genTCRuler(_this2.ifbDevice, 'incoming', rule, rules.incoming[rule], qdiscMinorId, netemMajorId);

          return tcRuler.executeRules().then(function () {
            qdiscMinorId = tcRuler.qdiscMinorId;
            netemMajorId = tcRuler.netemMajorId;
          });
        });
      });

      return _bluebird2.default.mapSeries(actions, function (action) {
        return action.bind(_this2)();
      });
    }
  }]);

  return TCWrapper;
}();

exports.default = TCWrapper;