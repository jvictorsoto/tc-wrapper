import sinon from 'sinon';
import { expect } from 'chai';
import childProcessPromise from 'child-process-promise';
import BPromise from 'bluebird';

import TCclassParser from './TCclassParser';

describe('TCclassParser sunny cases', () => {
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

    const filter = new TCclassParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse one class with rate', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: 'class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b\n',
      stderr: ''
    }));

    const filter = new TCclassParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            classid: '1a37:1',
            rate: '1G'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
  it('can parse two classes with rate', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `class htb 1a37:1 root prio 0 rate 1Gbit ceil 1Gbit burst 1375b cburst 1375b
      class htb 1a37:2 root leaf 1ab7: prio 0 rate 10Mbit ceil 10Mbit burst 125Kb cburst 125Kb\n`,
      stderr: ''
    }));

    const filter = new TCclassParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([
          {
            classid: '1a37:1',
            rate: '1G'
          },
          {
            classid: '1a37:2',
            rate: '10M'
          }
        ]);
        done(null);
      })
      .catch(err => done(err));
  });
});

// TODO: More tests, try to generate tc output here instead of copying examples.
