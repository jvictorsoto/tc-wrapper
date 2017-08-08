import helpers from './helpers';

const debug = require('debug')('tc-wrapper:TCfilterParser');

const FilterMatchIdIpv4 = {
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
class TCfilterParser {
  constructor(device, ipv = 4) {
    this.device = device;
    this.parsedData = [];
    this.ipv = ipv;

    this._clear();
  }

  parse() {
    return helpers.execCmd(`tc filter show dev ${this.device}`, [new RegExp('Cannot find device', 'i')])
      .then((stdout) => {
        const strippedOut = stdout.trim().match(/[^\r\n]+/g) || [];

        strippedOut.forEach((line) => {
          if (!line || line.length < 1) {
            return;
          }
          // Crap state machine to be able to parse multi line rules (blahblah flowid \n match blahblah). TODO: Improve
          const tcFilter = this._getFilter();

          if (this._parseFlowId(line)) {
            debug(`Success to parse flowid on line: ${line}`);
            if (tcFilter.flowid) {
              this.parsedData.push(tcFilter);
              this._clear();
              this._parseFlowId(line);
            }
            return;
          }

          if (this._parseProtocol(line)) {
            debug(`Success to parse protocol on line: ${line}`);
            return;
          }
          if (this.ipv === 4) {
            this._parseFilterIPv4(line);
          } else {
            throw new Error('IPv6 not supported yet... :(');
          }
        });

        if (this._flowId) {
          this.parsedData.push(this._getFilter());
        }
        return this.parsedData;
      });
  }

  _clear() {
    this._flowId = null;
    this._filterSrcNetwork = null;
    this._filterDstNetwork = null;
    this._filterSrcPort = null;
    this._filterDstPort = null;
  }

  _getFilter() {
    return {
      flowid: this._flowId,
      srcNetwork: this._filterSrcNetwork,
      dstNetwork: this._filterDstNetwork,
      srcPort: this._filterSrcPort,
      dstPort: this._filterDstPort,
      protocol: this._protocol
    };
  }

  _parseFlowId(line) {
    // Line looks like: filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
    const regex = new RegExp('.*(flowid)\\s+([\\w\\:]+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return false; } // Not our line...

    this._flowId = parsedLine[2];
    return true;
  }

  _parseProtocol(line) {
    // Line looks like: filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
    const regex = new RegExp('.*(protocol)\\s+([\\w]+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return false; } // Not our line...

    this._protocol = parsedLine[2];
    return true;
  }

  _parseFilterMatchLine(line) { // eslint-disable-line class-methods-use-this
    // Line looks like:  match c0a80101/ffffffff at 16
    const regex = new RegExp('.*match\\s+(\\w+)\\/(\\w+)\\s+at\\s+(\\w+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return false; } // Not our line...

    return { valueHex: parsedLine[1], maskHex: parsedLine[2], matchId: parseInt(parsedLine[3], 10) };
  }

  _parseFilterIPv4(line) {
    const parsedMatchLine = this._parseFilterMatchLine(line);
    if (!parsedMatchLine) { return false; }  // Not our line...

    const { valueHex, maskHex, matchId } = parsedMatchLine;

    if (FilterMatchIdIpv4.INCOMING_NETWORK === matchId || FilterMatchIdIpv4.OUTGOING_NETWORK === matchId) {
      // IPs v4 are easy, 4 sets of 2 hex digits, netmasks are 8 hex digits, translate both to dec. Out ex: 0.0.0.0/32
      const ip = valueHex.match(/.{2}/g).map(set => parseInt(set, 16)).join('.');
      const netmask =
        ((parseInt(maskHex, 16) >>> 0).toString(2).match(/1/g) || []).length; // eslint-disable-line no-bitwise

      if (FilterMatchIdIpv4.INCOMING_NETWORK === matchId) {
        this._filterSrcNetwork = `${ip}/${netmask}`;
      } else {
        this._filterDstNetwork = `${ip}/${netmask}`;
      }
    } else if (matchId === FilterMatchIdIpv4.PORT) {
      // Ports are eight hex digits, upper-half represents src port and the bottom-half represents dst port
      this._filterSrcPort = parseInt(valueHex.substring(0, 4), 16) || null;
      this._filterDstPort = parseInt(valueHex.substring(4, 8), 16) || null;
    }

    return true;
  }
}

export default TCfilterParser;
