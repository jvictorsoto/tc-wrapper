import Promise from 'bluebird';
import md5 from 'md5';
import Joi from 'joi';

import TCfilterParser from './TCfilterParser';
import TCqdiscParser from './TCqdiscParser';
import TCclassParser from './TCclassParser';
import TCRuler from './TCRuler';
import helpers from './helpers';
import validators from './validators';


const debug = require('debug')('tc-wrapper');

class TCWrapper {
  constructor(device) {
    this.device = device;
    this.deviceQdiscMajorId = this._genDeviceQdiscMajorId();
    this.ifbDevice = `ifb${parseInt(this.deviceQdiscMajorId, 16)}`;
    this.protocol = 'ip'; // IPv6 not suported yet, only IPv4
  }

  _genDeviceQdiscMajorId() {
    const baseDeviceHash = md5(this.device).substring(0, 3);
    const deviceHashPrefix = '1';
    return `${deviceHashPrefix}${baseDeviceHash}`;
  }

  _genFilterKey(filterParam) { // eslint-disable-line class-methods-use-this
    const params = [];
    if (filterParam.srcNetwork !== null) { params.push(`srcNetwork=${filterParam.srcNetwork}`); }
    if (filterParam.dstNetwork !== null) { params.push(`dstNetwork=${filterParam.dstNetwork}`); }
    if (filterParam.srcPort !== null) { params.push(`srcPort=${filterParam.srcPort}`); }
    if (filterParam.dstPort !== null) { params.push(`dstPort=${filterParam.dstPort}`); }
    if (filterParam.protocol !== null) { params.push(`protocol=${filterParam.protocol}`); }

    return params.join(',');
  }

  _getShapingRule(target, ipv = 4) {
    const tcFilterParser = new TCfilterParser(target, ipv);
    const tcQdiscParser = new TCqdiscParser(target, ipv);
    const tcClassParser = new TCclassParser(target, ipv);

    return Promise.all([tcFilterParser.parse(), tcQdiscParser.parse(), tcClassParser.parse()])
      .then((results) => {
        const [filterParams, qdiscParams, classParams] = results;
        const shapingRuleMapping = {};

        filterParams.forEach((filterParam) => {
          const shapingRule = {};

          const filterKey = this._genFilterKey(filterParam);
          if (filterKey.length === 0) {
            return;
          }

          qdiscParams.forEach((qdiscParam) => {
            if (qdiscParam.parent !== filterParam.flowid) { return; } // Not our qdisc

            // Clone qdisc and remove parent key as we match it in the result
            const qdiscParamClone = Object.assign({}, qdiscParam);
            delete qdiscParamClone.parent;
            Object.assign(shapingRule, qdiscParamClone);
          });

          classParams.forEach((classParam) => {
            if (classParam.classid !== filterParam.flowid) { return; } // Not our class

            // Clone class and remove classid key as we match it in the result
            const classParamClone = Object.assign({}, classParam);
            delete classParamClone.classid;
            Object.assign(shapingRule, classParamClone);
          });

          if (!shapingRule) { return; }

          debug(`rule found: ${filterKey} -> ${JSON.stringify(shapingRule)}`);
          shapingRuleMapping[filterKey] = shapingRule;
        });

        return shapingRuleMapping;
      });
  }

  del() {
    debug(`About to delete rules of iface: ${this.device}`);
    const commands = [
      // Delete out qdisc
      {
        cmd: `tc qdisc del dev ${this.device} root`,
        allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i'),
          new RegExp('Error: Cannot delete qdisc with handle of zero.', 'i')]
      },
      // Delete in qdisc
      {
        cmd: `tc qdisc del dev ${this.device} ingress`,
        allowedErrors: [
          new RegExp('RTNETLINK answers: Invalid argument', 'i'),
          new RegExp('RTNETLINK answers: No such file or directory', 'i'),
          new RegExp('Error: Invalid handle.', 'i'),
          new RegExp('Error: Cannot find specified qdisc on specified device.', 'i')]
      },
    ];

    // If ifb device is up delete it too!
    if (helpers.checkNetworkIface(this.ifbDevice)) {
      debug(`ifbDevice ${this.ifbDevice} present, deleting it too...`);
      [
        {
          cmd: `tc qdisc del dev ${this.ifbDevice} root`,
          allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i'),
            new RegExp('Error: Cannot delete qdisc with handle of zero.', 'i')]
        },
        {
          cmd: `ip link set dev ${this.ifbDevice} down`,
          allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i')]
        },
        {
          cmd: `ip link delete ${this.ifbDevice} type ifb`,
          allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i')]
        }
      ].forEach(c => commands.push(c));
    }

    return Promise.mapSeries(commands, (command) => {
      debug(`Running command ${command}...`);
      return helpers.execCmd(command.cmd, command.allowedErrors)
        .catch((err) => {
          throw new Error(`Error executing cmd: ${command.cmd} with allowedErrors: ${command.allowedErrors}: ${err}`);
        });
    });
  }

  get(ipv) {
    debug(`About to fetch rules of ifaces: ${this.device}, ${this.ifbDevice}`);
    return Promise.all([this._getShapingRule(this.device, ipv), this._getShapingRule(this.ifbDevice, ipv)])
      .then((results) => {
        const [outgoing, incoming] = results;
        return { outgoing, incoming };
      });
  }

  _enableIfbDevice() {
    const commands = [
      { cmd: 'modprobe ifb', allowedErrors: [] }, // Check if ifb module is present in Kernel
      {
        cmd: `ip link add ${this.ifbDevice} type ifb`,
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      },
      { cmd: `ip link set dev ${this.ifbDevice} up`, allowedErrors: [] },
      {
        cmd: `tc qdisc add dev ${this.device} ingress`,
        allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
      },
      {
        cmd: `tc filter add dev ${this.device} parent ffff: protocol ${this.protocol} u32 match u32 0 0 ` +
        `flowid ${this.deviceQdiscMajorId}: action mirred egress redirect dev ${this.ifbDevice}`,
        allowedErrors: []
      },
    ];

    return Promise.mapSeries(commands, (command) => {
      debug(`Running command ${command}...`);
      return helpers.execCmd(command.cmd, command.allowedErrors)
        .catch((err) => {
          throw new Error(`Error executing cmd: ${command.cmd} with allowedErrors: ${command.allowedErrors}: ${err}`);
        });
    });
  }

  _genTCRuler(device, direction, rule, rulePayload, qdiscMinorId, netemMajorId) {
    // Mandatory rule parameters.
    let srcNetwork = null;
    let dstNetwork = null;
    try {
      srcNetwork = rule.match(/.*srcNetwork=(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}).*/)[1];
    } catch (e) { /* ignored */ }

    try {
      dstNetwork = rule.match(/.*dstNetwork=(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}).*/)[1];
    } catch (e) { /* ignored */ }

    const protocol = rule.match(/.*protocol=(\w+).*/)[1];

    // Optional rule parameters
    let srcPort = null;
    let dstPort = null;
    try {
      srcPort = rule.match(/.*srcPort=(\d+).*/)[1];
    } catch (e) { /* ignored */ }
    try {
      dstPort = rule.match(/.*dstPort=(\d+).*/)[1];
    } catch (e) { /* ignored */ }

    const tcRuler = new TCRuler(device, this.deviceQdiscMajorId, direction, dstNetwork, srcNetwork, protocol, dstPort,
      srcPort, rulePayload, qdiscMinorId, netemMajorId);

    return tcRuler;
  }

  set(inputRules) {
    const { error, value: rules } = Joi.validate(inputRules, validators.setRules);
    if (error) {
      throw new Error(`Rules validation error: ${error.message}`);
    }

    rules.outgoing = rules.outgoing || {};
    rules.incoming = rules.incoming || {};

    const actions = [this.del];

    // Store ids for multiple ruling
    let qdiscMinorId;
    let netemMajorId;

    // Iterate over all outgoing rules and set them
    actions.push(
      () => Promise.mapSeries(Object.keys(rules.outgoing), (rule) => {
        const tcRuler = this._genTCRuler(this.device, 'outgoing', rule,
          rules.outgoing[rule], qdiscMinorId, netemMajorId);

        return tcRuler.executeRules().then(() => {
          qdiscMinorId = tcRuler.qdiscMinorId;
          netemMajorId = tcRuler.netemMajorId;
        });
      })
    );

    if (rules.incoming && Object.keys(rules.incoming).length > 0) {
      actions.push(this._enableIfbDevice);
      // Clean ids...
      actions.push(() => new Promise((resolve) => {
        qdiscMinorId = undefined;
        netemMajorId = undefined;
        resolve(null);
      }));
    }

    // Iterate over all incoming rules and set them
    actions.push(
      () => Promise.mapSeries(Object.keys(rules.incoming), (rule) => {
        const tcRuler = this._genTCRuler(this.ifbDevice, 'incoming', rule,
          rules.incoming[rule], qdiscMinorId, netemMajorId);

        return tcRuler.executeRules().then(() => {
          qdiscMinorId = tcRuler.qdiscMinorId;
          netemMajorId = tcRuler.netemMajorId;
        });
      })
    );

    return Promise.mapSeries(actions, action => action.bind(this)());
  }
}

export default TCWrapper;
