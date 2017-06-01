import Promise from 'bluebird';
import md5 from 'md5';

import TCfilterParser from './TCfilterParser';
import TCqdiscParser from './TCqdiscParser';
import TCclassParser from './TCclassParser';
import helpers from './helpers';


const debug = require('debug')('tc-wrapper');

class TCWrapper {
  constructor(iface) {
    this.iface = iface;
    this.ifbDevice = `ifb${this._genIfbDeviceId()}`;
  }

  _genIfbDeviceId() {
    const baseDeviceHash = md5(this.iface).substring(0, 3);
    const deviceHashPrefix = '1';

    return parseInt(`${deviceHashPrefix}${baseDeviceHash}`, 16);
  }

  _genFilterKey(filterParam) { // eslint-disable-line class-methods-use-this
    const params = [];
    if (filterParam.network !== null) { params.push(`network=${filterParam.network}`); }
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

          debug(`rule found: ${filterKey} -> ${shapingRule}`);
          shapingRuleMapping[filterKey] = shapingRule;
        });

        return shapingRuleMapping;
      });
  }

  del() {
    debug(`About to delete rules of iface: ${this.iface}`);
    const commands = [
      // Delete out qdisc
      {
        cmd: `tc qdisc del dev ${this.iface} root`,
        allowedErrors: [new RegExp('RTNETLINK answers: No such file or directory', 'i')]
      },
      // Delete in qdisc
      {
        cmd: `tc qdisc del dev ${this.iface} ingress`,
        allowedErrors: [
          new RegExp('RTNETLINK answers: Invalid argument', 'i'),
          new RegExp('RTNETLINK answers: No such file or directory', 'i')]
      },
    ];

    // If ifb device is up delete it too!
    if (helpers.checkNetworkIface(this.ifbDevice)) {
      debug(`ifbDevice ${this.ifbDevice} present, deleting it too...`);
      [
        { cmd: `tc qdisc del dev ${this.ifbDevice} root`, allowedErrors: [] },
        { cmd: `ip link set dev ${this.ifbDevice} down`, allowedErrors: [] },
        { cmd: `ip link delete ${this.ifbDevice} type ifb`, allowedErrors: [] },
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
    debug(`About to fetch rules of ifaces: ${this.iface}, ${this.ifbDevice}`);
    return Promise.all([this._getShapingRule(this.iface, ipv), this._getShapingRule(this.ifbDevice, ipv)])
      .then((results) => {
        const [outgoing, incoming] = results;
        return { outgoing, incoming };
      });
  }
}

export default TCWrapper;
