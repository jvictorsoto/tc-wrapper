import helpers from './helpers';

class TCqdiscParser {
  constructor(device) {
    this.device = device;
    this.parsedParams = [];
    this._clear();
  }

  parse() {
    return helpers.execCmd(`tc qdisc show dev ${this.device}`)
      .then((stdout) => {
        const strippedOut = stdout.trim().match(/[^\r\n]+/g) || [];

        strippedOut.forEach((line) => {
          if (line.indexOf('qdisc netem') === -1 && line.indexOf('qdisc tbf') === -1) {
            return;
          }

          if (line.indexOf('qdisc netem') > -1) {
            this._parseNetemParam(line, 'parent', '\\w+\\:\\w+');
          }

          this._parseNetemParam(line, 'delay', '\\d+\\.\\d+\\w+');
          this._parseNetemDelayAndJitter(line);
          this._parseNetemParam(line, 'loss', '[\\d\\.]+\\%');
          this._parseNetemParam(line, 'corrupt', '[\\d\\.]+\\%');
          this._parseTbfRate(line); // TODO: Check that this works fine, I only support htb rate not tbf...

          this.parsedParams.push(this.parsedParam);
          this._clear();
        });

        return this.parsedParams;
      });
  }

  _clear() {
    this.parsedParam = {};
  }

  _parseNetemDelayAndJitter(line) {
    // Line looks like: qdisc netem 1aba: parent 1a37:5 limit 1000 delay 20.0ms  1.5ms loss 11%
    const regex = new RegExp('.*(delay)\\s+(\\d+\\.\\d+\\w+)\\s+(\\d+\\.\\d+\\w+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return; } // Not our line...

    this.parsedParam.delay = parsedLine[2];
    this.parsedParam.jitter = parsedLine[3];
  }

  _parseNetemParam(line, parseParamName, pattern) {
    // Line looks like: qdisc netem 1aba: parent 1a37:5 limit 1000 delay 20.0ms  1.5ms loss 11%
    const regex = new RegExp(`.*(${parseParamName})\\s+(${pattern}).*`);
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return; } // Not our line...

    this.parsedParam[parseParamName] = parsedLine[2];
  }

  _parseTbfRate(line) {
    // Line looks like:  qdisc tbf 20: parent 1a41:1 rate 20Mbit burst 20000b limit 10000b
    const regex = new RegExp('.*(rate)\\s+(\\d+\\w+).*');
    const parsedLine = line.match(regex);
    if (parsedLine === null) { return; } // Not our line...

    this.parsedParam.rate = parsedLine[2];
  }
}

export default TCqdiscParser;
