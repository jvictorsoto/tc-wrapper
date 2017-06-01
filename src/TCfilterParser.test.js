import sinon from 'sinon';
import { expect } from 'chai';
import childProcessPromise from 'child-process-promise';
import BPromise from 'bluebird';

import TCfilterParser from './TCfilterParser';

describe('TCfilterParser sunny cases', () => {
  let execStub;

  before(() => {
    // Lets create a stub arround exec operation
    execStub = sinon.stub(childProcessPromise, 'exec');
  });

  after(() => {
    execStub.restore();
  });

  it('can parse no filters', (done) => {
    execStub.returns(BPromise.resolve({ stdout: '', stderr: '' }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal([]);
        done(null);
      })
      .catch(err => done(err));
  });

  it('can parse filter on 0.0.0.0/0', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `filter parent 1a37: protocol ip pref 1 u32
      filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
        match 00000000/00000000 at 16`,
      stderr: ''
    }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal(
          [{
            flowid: '1a37:2',
            network: '0.0.0.0/0',
            srcPort: null,
            dstPort: null,
            protocol: 'ip'
          }]);
        done(null);
      })
      .catch(err => done(err));
  });

  it('can parse filter on 0.0.0.0/0 on port 80', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `filter parent 1a37: protocol ip pref 1 u32
      filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
        match 00000000/00000000 at 16
        match 00000050/0000ffff at 20`,
      stderr: ''
    }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal(
          [{
            flowid: '1a37:2',
            network: '0.0.0.0/0',
            srcPort: null,
            dstPort: 80,
            protocol: 'ip'
          }]);
        done(null);
      })
      .catch(err => done(err));
  });

  it('can parse filter on 192.168.1.1/32', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `filter parent 1a37: protocol ip pref 1 u32
      filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
        match c0a80101/ffffffff at 16`,
      stderr: ''
    }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal(
          [{
            flowid: '1a37:2',
            network: '192.168.1.1/32',
            srcPort: null,
            dstPort: null,
            protocol: 'ip'
          }]);
        done(null);
      })
      .catch(err => done(err));
  });

  it('can parse filter on 192.168.1.1/32 on port 80', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `filter parent 1a37: protocol ip pref 1 u32
      filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
        match c0a80101/ffffffff at 16
        match 00000050/0000ffff at 20`,
      stderr: ''
    }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal(
          [{
            flowid: '1a37:2',
            network: '192.168.1.1/32',
            srcPort: null,
            dstPort: 80,
            protocol: 'ip'
          }]);
        done(null);
      })
      .catch(err => done(err));
  });

  it('can parse filter on 192.168.1.1/32 and 10.10.10.0/28', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `filter parent 1a37: protocol ip pref 1 u32
      filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
        match c0a80101/ffffffff at 16
      filter parent 1a37: protocol ip pref 1 u32 fh 800::801 order 2049 key ht 800 bkt 0 flowid 1a37:3
        match 0a0a0a00/fffffff0 at 16`,
      stderr: ''
    }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal(
          [{
            flowid: '1a37:2',
            network: '192.168.1.1/32',
            srcPort: null,
            dstPort: null,
            protocol: 'ip'
          },
          {
            flowid: '1a37:3',
            network: '10.10.10.0/28',
            srcPort: null,
            dstPort: null,
            protocol: 'ip'
          }]);
        done(null);
      })
      .catch(err => done(err));
  });

  it('can parse filter on 192.168.1.1/32 on port 90 and 10.10.10.0/28 on port 2020', (done) => {
    execStub.returns(BPromise.resolve({
      stdout: `filter parent 1a37: protocol ip pref 1 u32
      filter parent 1a37: protocol ip pref 1 u32 fh 800: ht divisor 1
      filter parent 1a37: protocol ip pref 1 u32 fh 800::800 order 2048 key ht 800 bkt 0 flowid 1a37:2
        match c0a80101/ffffffff at 16
        match 0000005a/0000ffff at 20
      filter parent 1a37: protocol ip pref 1 u32 fh 800::801 order 2049 key ht 800 bkt 0 flowid 1a37:3
        match 0a0a0a00/fffffff0 at 16
        match 000007e4/0000ffff at 20`,
      stderr: ''
    }));

    const filter = new TCfilterParser('enp2s0');

    filter.parse()
      .then((result) => {
        expect(result).to.deep.equal(
          [{
            flowid: '1a37:2',
            network: '192.168.1.1/32',
            srcPort: null,
            dstPort: 90,
            protocol: 'ip'
          },
          {
            flowid: '1a37:3',
            network: '10.10.10.0/28',
            srcPort: null,
            dstPort: 2020,
            protocol: 'ip'
          }]);
        done(null);
      })
      .catch(err => done(err));
  });
});

// TODO: More tests, try to generate tc output here instead of copying examples.
