import Promise from 'bluebird';
import fs from 'fs';
import helpers from './helpers';

const debug = require('debug')('tc-wrapper:TCRulerIncoming');

const DEFAULT_CLASS_MINOR_ID = 1;

class TCRulerIncoming {
  constructor(device, deviceQdiscMajorId, dstNetwork, srcNetwork, protocol, dstPort, srcPort, options,
              qdiscMinorId = DEFAULT_CLASS_MINOR_ID, netemMajorId) {
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

  _genMakeNetemQdiscCmd() {
    return {
      cmd: `tc qdisc add dev ${this.device} parent ${this.deviceQdiscMajorId}:${this.qdiscMinorId} handle 1111: netem`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };
  }

  // TODO: Convert to async...
  _getMaxRate() {
    // Max default rate of linux kernel is 32G, lets see if we can get the iface limit.
    const maxRate = '32Gbit';
    try {
      const ifaceLimit = fs.readFileSync(`/sys/class/net/${this.device}/speed`, 'utf8');
      this.deviceMaxRate = `${ifaceLimit.match(/(\d+)/)[1]}Mbit`;
      return;
    } catch (e) { /* ignored */ }

    this.deviceMaxRate = maxRate;
  }

  _genRateCmd() {
    const customRate = this.options.rate !== undefined;
    const rateStr = customRate ? this.options.rate : this.deviceMaxRate;
    return {
      // TODO: calculate buffer and limit according to rate
      cmd: `tc qdisc add dev ${this.device} parent 1111:${this.qdiscMinorId} handle 20: tbf ` +
      `rate ${rateStr} buffer 30000 limit 10000`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };
  }


  _genAddFilterCmd() {
    const cmd = {
      cmd: `tc filter add dev ${this.device} protocol ${this.protocol} parent ${this.deviceQdiscMajorId}: prio 2 u32`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };

    if (this.srcNetwork !== null) {
      cmd.cmd += ` match ${this.protocol} src ${this.srcNetwork}`;
    }

    if (this.dstNetwork !== null) {
      cmd.cmd += ` match ${this.protocol} dst ${this.dstNetwork}`;
    }

    if (this.srcPort !== null) {
      cmd.cmd += ` match ${this.protocol} sport ${this.srcPort} 0xffff`;
    }
    if (this.dstPort !== null) {
      cmd.cmd += ` match ${this.protocol} dport ${this.dstPort} 0xffff`;
    }

    cmd.cmd += ` flowid ${this.deviceQdiscMajorId}:${this.qdiscMinorId}`;
    return cmd;
  }

  genRulesCmds() {
    const cmds = [];

    cmds.push(this._genMakeNetemQdiscCmd());
    cmds.push(this._genRateCmd());
    cmds.push(this._genAddFilterCmd());
    debug(`TC Rules cmds generated:\n${cmds.map(cmd => `   ${cmd.cmd}\n`).join('')}`);
    return cmds;
  }

  executeRules() {
    return Promise.mapSeries(this.genRulesCmds(), cmd => helpers.execCmd(cmd.cmd, cmd.allowedErrors));
  }
}

export default TCRulerIncoming;
