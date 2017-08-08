import Promise from 'bluebird';
import fs from 'fs';
import helpers from './helpers';

const debug = require('debug')('tc-wrapper:TCRuler');

const DEFAULT_CLASS_MINOR_ID = 1;

// Only supports htb shapping...
class TCRuler {
  constructor(device, deviceQdiscMajorId, direction, dstNetwork, srcNetwork, protocol, dstPort, srcPort, options,
    qdiscMinorId = DEFAULT_CLASS_MINOR_ID, netemMajorId) {
    this.device = device;
    this.deviceQdiscMajorId = deviceQdiscMajorId;
    this.direction = direction;
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

  _genMakeQdiscCmd() {
    return {
      cmd: `tc qdisc add dev ${this.device} root handle ${this.deviceQdiscMajorId}: htb ` +
      `default ${DEFAULT_CLASS_MINOR_ID}`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };
  }

  _getQdiscMinorId() {
    return ++this.qdiscMinorId; // eslint-disable-line no-plusplus
  }

  _getNetemMajorId() {
    if (this.netemMajorId === undefined || this.netemMajorId === null) {
      this.netemMajorId = (parseInt(this.deviceQdiscMajorId, 16) + 128).toString(16);
    } else {
      this.netemMajorId = (parseInt(this.netemMajorId, 16) + 1).toString(16);
    }

    return this.netemMajorId;
  }

  // TODO: Convert to async...
  _getMaxRate() {
    // Max default rate of linux kernel is 32G, lets see if we can get the iface limit.
    const maxRate = '32Gbit';
    try {
      const ifaceLimit = fs.readFileSync(`/sys/class/net/${this.device}/speed`, 'utf8');
      this.deviceMaxRate = `${ifaceLimit.match(/(\d+)/)[1]}Mbit`;
    } catch (e) { /* ignored */ }

    this.deviceMaxRate = maxRate;
  }

  _genDefaultClass() {
    return {
      cmd: `tc class add dev ${this.device} parent ${this.deviceQdiscMajorId}: classid ${this.deviceQdiscMajorId}:` +
      `${DEFAULT_CLASS_MINOR_ID} htb rate ${this.deviceMaxRate}`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };
  }

  _genRateCmd() {
    const customRate = this.options.rate !== undefined;
    const cmd = {
      cmd: `tc class add dev ${this.device} parent ${this.deviceQdiscMajorId}: classid ${this.deviceQdiscMajorId}:` +
      `${this._getQdiscMinorId()} htb rate ${(customRate) ? this.options.rate : this.deviceMaxRate} ` +
      `ceil ${(customRate) ? this.options.rate : this.deviceMaxRate}`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };

    if (customRate) {
      const rate = parseInt(this.options.rate.match(/(\d+)(\w+)/)[1], 10);
      const rateUnit = this.options.rate.match(/(\d+)(\w+)/)[2];
      // Default values of burst and cburst, needed on custom rate.
      const burstRate = rate / (10 * 8);
      const cburstRate = rate / (10 * 8);
      cmd.cmd += ` burst ${burstRate}${rateUnit} cburst ${cburstRate}${rateUnit}`;
    }

    return cmd;
  }

  _genSetNetemCmd() {
    const cmd = {
      cmd: `tc qdisc add dev ${this.device} parent ${this.deviceQdiscMajorId}:${this.qdiscMinorId} ` +
      `handle ${this._getNetemMajorId()}: netem`,
      allowedErrors: [new RegExp('RTNETLINK answers: File exists', 'i')]
    };

    if (this.options.loss !== undefined) {
      cmd.cmd += ` loss ${this.options.loss}`;
    }

    if (this.options.delay !== undefined) {
      cmd.cmd += ` delay ${this.options.delay}`;
    }

    if (this.options.delay !== undefined && this.options.jitter !== undefined) {
      cmd.cmd += ` ${this.options.jitter} distribution normal`;
    }

    if (this.options.corrupt !== undefined) {
      cmd.cmd += ` corrupt ${this.options.corrupt}`;
    }
    return cmd;
  }

  _genAddFilterCmd() {
    const cmd = {
      cmd: `tc filter add dev ${this.device} protocol ip parent ${this.deviceQdiscMajorId}: prio 1 u32`,
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
    cmds.push(this._genMakeQdiscCmd());
    cmds.push(this._genDefaultClass());
    cmds.push(this._genRateCmd());
    cmds.push(this._genSetNetemCmd());
    cmds.push(this._genAddFilterCmd());
    debug(`TC Rules cmds generated:\n${cmds.map(cmd => `   ${cmd.cmd}\n`).join('')}`);
    return cmds;
  }

  executeRules() {
    return Promise.mapSeries(this.genRulesCmds(), cmd => helpers.execCmd(cmd.cmd, cmd.allowedErrors));
  }
}

export default TCRuler;
