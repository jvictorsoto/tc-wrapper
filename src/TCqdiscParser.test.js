import sinon from 'sinon';
import { expect } from 'chai';
import childProcessPromise from 'child-process-es6-promise';
import BPromise from 'bluebird';

import TCqdiscParser from './TCqdiscParser';

describe('TCqdiscParser sunny cases', () => {
  let execStub;

  before(() => {
    // Lets create a stub arround exec operation
    execStub = sinon.stub(childProcessPromise, 'exec');
  });

  after(() => {
    execStub.restore();
  });

  it('can parse no qdiscs', (done) => {
    execStub.returns(BPromise.resolve({ stdout: '', stderr: '' }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent alone', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two parents alone', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000
      qdisc netem 1ab8: parent 1a37:3 limit 1000`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2'
          },
          {
            parent: '1a37:3'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with loss', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 loss 10%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            loss: '10%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with loss with decimals', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 loss 10.9%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            loss: '10.9%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two parents with loss', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 loss 10%
      qdisc netem 1ab8: parent 1a37:3 limit 1000 loss 5%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            loss: '10%'
          },
          {
            parent: '1a37:3',
            loss: '5%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with delay', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 10.0ms`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            delay: '10.0ms'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two parents with delay', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 10.0ms
      qdisc netem 1ab8: parent 1a37:3 limit 1000 delay 5.0ms`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            delay: '10.0ms'
          },
          {
            parent: '1a37:3',
            delay: '5.0ms'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with delay and jitter', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 10.0ms  2.0ms`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            delay: '10.0ms',
            jitter: '2.0ms'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two parents with delay and jitter', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 10.0ms  2.0ms
      qdisc netem 1ab8: parent 1a37:3 limit 1000 delay 5.0ms  1.0ms`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            delay: '10.0ms',
            jitter: '2.0ms'
          },
          {
            parent: '1a37:3',
            delay: '5.0ms',
            jitter: '1.0ms'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with corrupt', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 corrupt 1%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            corrupt: '1%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with corrupt with decimals', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 corrupt 1.6%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            corrupt: '1.6%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two parents with corrupt', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 corrupt 1%
      qdisc netem 1ab8: parent 1a37:3 limit 1000 corrupt 5%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            corrupt: '1%'
          },
          {
            parent: '1a37:3',
            corrupt: '5%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with delay and loss', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 5.0ms loss 1%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            loss: '1%',
            delay: '5.0ms'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two parents with delay and loss', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 5.0ms loss 1%
      qdisc netem 1ab8: parent 1a37:3 limit 1000 delay 20.0ms loss 3%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            loss: '1%',
            delay: '5.0ms'
          },
          {
            parent: '1a37:3',
            loss: '3%',
            delay: '20.0ms'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one parent with delay jitter loss and corruption', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `qdisc htb 1a37: root refcnt 9 r2q 10 default 1 direct_packets_stat 0 direct_qlen 1000
      qdisc netem 1ab7: parent 1a37:2 limit 1000 delay 5.0ms  2.0ms loss 1% corrupt 3%`,
      stderr: ''
    }));

    const filter = new TCqdiscParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            parent: '1a37:2',
            delay: '5.0ms',
            jitter: '2.0ms',
            loss: '1%',
            corrupt: '3%'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
});
