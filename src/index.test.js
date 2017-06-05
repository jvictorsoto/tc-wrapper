import sinon from 'sinon';
import { expect } from 'chai';
import childProcessPromise from 'child-process-promise';
import BPromise from 'bluebird';

import TCWrapper from './index';

describe('TCWrapper get Operation', () => {
  let execStub;

  before(() => {
    // Lets create a stub arround exec operation
    execStub = sinon.stub(childProcessPromise, 'exec');
  });

  after(() => {
    execStub.restore();
  });

  it('works fine without any rules', (done) => {
    const tc = new TCWrapper('enp2s0');

    execStub.withArgs(`tc qdisc show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: 'qdisc mq 0: root\nqdisc pfifo_fast 0: parent :1 bands 3 priomap  1 2 2 2 1 2 0 0 1 1 1 1 1 1 1 1\n' +
        'qdisc pfifo_fast 0: parent :2 bands 3 priomap  1 2 2 2 1 2 0 0 1 1 1 1 1 1 1 1',
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));

    // ifb device
    execStub.withArgs(`tc qdisc show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: 'qdisc mq 0: root\nqdisc pfifo_fast 0: parent :1 bands 3 priomap  1 2 2 2 1 2 0 0 1 1 1 1 1 1 1 1\n' +
        'qdisc pfifo_fast 0: parent :2 bands 3 priomap  1 2 2 2 1 2 0 0 1 1 1 1 1 1 1 1',
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));

    tc.get()
      .then((result) => {
        expect(result).to.deep.equal({
          outgoing: {},
          incoming: {}
        });
        done(null);
      })
      .catch(err => done(err));
  });

  it('parse rate outgoing alone fine', (done) => {
    const tc = new TCWrapper('enp2s0');

    execStub.withArgs(`tc qdisc show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: 'qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000\n' +
        'qdisc netem 1ab7: parent 1a37:2 limit 1000\n',
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: 'class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b\n' +
        'class htb 1a37:2 root leaf 1ab7: prio 0 rate 10Mbit ceil 10Mbit burst 125Kb cburst 125Kb\n',
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: 'filter parent 1a37: protocol ip pref 1 u32\n' +
        'filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1\n' +
        'filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2\n' +
        '  match 00000000/00000000 at 16\n',
        stderr: ''
      }));

    // ifb device
    execStub.withArgs(`tc qdisc show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: '',
        stderr: ''
      }));

    tc.get()
      .then((result) => {
        expect(result).to.deep.equal({
          outgoing: {
            'network=0.0.0.0/0,protocol=ip': {
              rate: '10M'
            }
          },
          incoming: {}
        });
        done(null);
      })
      .catch(err => done(err));
  });

  it('parse rate outgoing and incoming fine', (done) => {
    const tc = new TCWrapper('enp2s0');

    execStub.withArgs(`tc qdisc show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
        qdisc netem 1ab7: parent 1a37:2 limit 1000
        qdisc ingress ffff: parent ffff:fff1 ----------------\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: `class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b
        class htb 1a37:2 root leaf 1ab7: prio 0 rate 10Mbit ceil 10Mbit burst 125Kb cburst 125Kb\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: `filter parent 1a37: protocol ip pref 1 u32
        filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
        filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
          match 00000000/00000000 at 16\n`,
        stderr: ''
      }));

    // ifb device
    execStub.withArgs(`tc qdisc show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: `qdisc htb 1a37: root refcnt 2 r2q 10 default 1 direct_packets_stat 1 direct_qlen 32
        qdisc netem 1ab7: parent 1a37:2 limit 1000\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: `class htb 1a37:1 root prio 0 rate 32Gbit ceil 32Gbit burst 0b cburst 0b
        class htb 1a37:2 root leaf 1ab7: prio 0 rate 30Mbit ceil 30Mbit burst 375Kb cburst 375Kb\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: `filter parent 1a37: protocol ip pref 1 u32
        filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
        filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
          match 00000000/00000000 at 12\n`,
        stderr: ''
      }));

    tc.get()
      .then((result) => {
        expect(result).to.deep.equal({
          outgoing: {
            'network=0.0.0.0/0,protocol=ip': {
              rate: '10M'
            }
          },
          incoming: {
            'network=0.0.0.0/0,protocol=ip': {
              rate: '30M'
            }
          }
        });
        done(null);
      })
      .catch(err => done(err));
  });
  it('parse rate loss corrupt delay jitter outgoing and incoming fine', (done) => {
    const tc = new TCWrapper('enp2s0');

    execStub.withArgs(`tc qdisc show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
        qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 1.0ms  0.5ms loss 3% corrupt 2%
        qdisc ingress ffff: parent ffff:fff1 ----------------\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: `class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b
        class htb 1a37:2 root leaf 1ab7: prio 0 rate 10Mbit ceil 10Mbit burst 125Kb cburst 125Kb\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.device}`).returns(BPromise.resolve(
      {
        stdout: `filter parent 1a37: protocol ip pref 1 u32
        filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
        filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
          match 00000000/00000000 at 16\n`,
        stderr: ''
      }));

    // ifb device
    execStub.withArgs(`tc qdisc show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: `qdisc htb 1a37: root refcnt 2 r2q 10 default 1 direct_packets_stat 0 direct_qlen 32
        qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 5.0ms  2.5ms loss 9% corrupt 7%\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc class show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: `class htb 1a37:1 root prio 0 rate 32Gbit ceil 32Gbit burst 0b cburst 0b
        class htb 1a37:2 root leaf 1ab7: prio 0 rate 34Mbit ceil 34Mbit burst 425Kb cburst 425Kb\n`,
        stderr: ''
      }));
    execStub.withArgs(`tc filter show dev ${tc.ifbDevice}`).returns(BPromise.resolve(
      {
        stdout: `filter parent 1a37: protocol ip pref 1 u32
        filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
        filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
          match 00000000/00000000 at 12\n`,
        stderr: ''
      }));

    tc.get()
      .then((result) => {
        expect(result).to.deep.equal({
          outgoing: {
            'network=0.0.0.0/0,protocol=ip': {
              delay: '1.0',
              jitter: '0.5',
              loss: '3',
              corrupt: '2',
              rate: '10M'
            }
          },
          incoming: {
            'network=0.0.0.0/0,protocol=ip': {
              delay: '5.0',
              jitter: '2.5',
              loss: '9',
              corrupt: '7',
              rate: '34M'
            }
          }
        });
        done(null);
      })
      .catch(err => done(err));
  });
});


describe('TCWrapper set Operation', () => {
  let execStub;

  before(() => {
    // Lets create a stub arround exec operation
    execStub = sinon.stub(childProcessPromise, 'exec');
  });

  after(() => {
    execStub.restore();
  });

  it('outgoing rate only on single network', (done) => {
    const tc = new TCWrapper('enp2s0');

    execStub.withArgs('tc qdisc add dev enp2s0 root handle 1a37: htb default 1')
      .returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc class add dev enp2s0 parent 1a37: classid 1a37:1 htb rate 32Gbit')
      .returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc class add dev enp2s0 parent 1a37: classid 1a37:2 htb rate 20Mbit ceil 20Mbit burst ' +
      '0.25Mbit cburst 0.25Mbit').returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc qdisc add dev enp2s0 parent 1a37:2 handle 1ab7: netem')
      .returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc filter add dev enp2s0 protocol ip parent 1a37: prio 1 u32 match ip dst 0.0.0.0/0 flowid ' +
      '1a37:2').returns(BPromise.resolve({ stdout: '', stderr: '' }));

    const rules = {
      outgoing: {
        'network=0.0.0.0/0,protocol=ip': {
          rate: '20Mbit'
        }
      },
      incoming: {}
    };

    tc.set(rules)
      .then(() => done(null))
      .catch(err => done(err));
  });

  it('incoming rate only on single network', (done) => {
    const tc = new TCWrapper('enp2s0');

    // ifb enabled on Kernel
    execStub.withArgs('modprobe ifb').returns(BPromise.resolve({ stdout: '', stderr: '' }));
    // Allow creating ifb device & mirror ingress traffic to it.
    execStub.withArgs('ip link add ifb6711 type ifb').returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('ip link set dev ifb6711 up').returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc qdisc add dev enp2s0 ingress').returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc filter add dev enp2s0 parent ffff: protocol ip u32 match u32 0 0 flowid 1a37: action mirred' +
      ' egress redirect dev ifb6711').returns(BPromise.resolve({ stdout: '', stderr: '' }));


    execStub.withArgs('tc qdisc add dev ifb6711 root handle 1a37: htb default 1')
      .returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc class add dev ifb6711 parent 1a37: classid 1a37:1 htb rate 32Gbit')
      .returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc class add dev ifb6711 parent 1a37: classid 1a37:2 htb rate 20Mbit ceil 20Mbit burst ' +
      '0.25Mbit cburst 0.25Mbit').returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc qdisc add dev ifb6711 parent 1a37:2 handle 1ab7: netem')
      .returns(BPromise.resolve({ stdout: '', stderr: '' }));
    execStub.withArgs('tc filter add dev ifb6711 protocol ip parent 1a37: prio 1 u32 match ip src 0.0.0.0/0 flowid ' +
      '1a37:2').returns(BPromise.resolve({ stdout: '', stderr: '' }));

    const rules = {
      incoming: {
        'network=0.0.0.0/0,protocol=ip': {
          rate: '20Mbit'
        }
      },
      outgoing: {}
    };

    tc.set(rules)
      .then(() => done(null))
      .catch(err => done(err));
  });
});
