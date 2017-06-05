import helpers from './helpers';

class TCclassParser {
  constructor(device) {
    this.device = device;
    this.parsedParams = [];
    this._clear();
  }

  parse() {
    return helpers.execCmd(`tc class show dev ${this.device}`, [new RegExp('Cannot find device', 'i')])
      .then((stdout) => {
        const strippedOut = stdout.trim().match(/[^\r\n]+/g) || [];

        strippedOut.forEach((line) => {
          if (!line || line.length < 1) {
            return;
          }

          this._parseClassId(line);
          this._parseHtbRate(line);

          this.parsedParams.push(this.parsedParam);
          this._clear();
        });

        return this.parsedParams;
      });
  }

  _clear() {
    this.parsedParam = {};
  }

  _parseClassId(line) {
    // Line looks like: class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b
    const regex = new RegExp('.*(class htb)\\s+([\\w\\:]+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return; } // Not our line...

    this.parsedParam.classid = parsedLine[2];
  }

  _parseHtbRate(line) {
    // Line looks like: class htb 1a37:2 root leaf 1ab7: prio 0 rate 20Mbit ceil 20Mbit burst 250Kb cburst 250Kb
    const regex = new RegExp('.*(rate)\\s+(\\d+\\w+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return; } // Not our line...

    this.parsedParam.rate = parsedLine[2];
  }
}

export default TCclassParser;
