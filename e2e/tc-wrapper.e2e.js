const debug = require('debug')('tc-wrapper:e2e');
const Promise = require('bluebird');
const expect = require('chai').expect;
const Client = require('myspeed').Client;
const TCWrapper = require('../').default;

const SPEED_TEST_ADDRESSES = JSON.parse(process.env.SPEED_TEST_ADDRESSES || '[]');

describe('TC Wrapper', function() {
  this.timeout(300000);
  let baseSpeedTest;

  before(async function before() {
    baseSpeedTest = await speedTest();
    debug(`BASE speedResult ${JSON.stringify(baseSpeedTest)}`);
  });

  beforeEach(async function afterEach() {
    await new TCWrapper('eth0').del();
  });

  it('limits upload and download speeds', async function test() {
    const tcWrapper = new TCWrapper('eth0');

    const downloadTarget = baseSpeedTest.download * 0.4;
    const uploadTarget = baseSpeedTest.upload * 0.5;

    await tcWrapper.set({
      incoming: {
        'srcNetwork=0.0.0.0/0,protocol=ip': {
          rate: `${downloadTarget}Mbit`
        }
      },
      outgoing: {
        'dstNetwork=0.0.0.0/0,protocol=ip': {
          rate: `${uploadTarget}Mbit`
        }
      }
    });

    const speedTestAfter = await speedTest();
    debug(`LIMITED speedResult ${JSON.stringify(speedTestAfter)}`);

    debug(`UPLOAD   - limit: ${uploadTarget}  expect(${speedTestAfter.upload}).to.be.at.least(${uploadTarget * 0.9})`);
    expect(speedTestAfter.upload).to.be.at.least(uploadTarget * 0.9);
    debug(`UPLOAD   - limit: ${uploadTarget}  expect(${speedTestAfter.upload}).to.be.at.most(${uploadTarget * 1.05});`);
    expect(speedTestAfter.upload).to.be.at.most(uploadTarget * 1.05);

    debug(`DOWNLOAD - limit: ${downloadTarget}  expect(${speedTestAfter.download}).to.be.at.least(${downloadTarget * 0.9});`);
    expect(speedTestAfter.download).to.be.at.least(downloadTarget * 0.9);
    debug(`DOWNLOAD - limit: ${downloadTarget}  expect(${speedTestAfter.download}).to.be.at.most(${downloadTarget * 1.05});`);
    expect(speedTestAfter.download).to.be.at.most(downloadTarget * 1.05);
  });
});


async function speedTest() {
  const result1 = await runSpeedTest();
  const result2 = await runSpeedTest();
  const result3 = await runSpeedTest();

  return {
    upload: Math.round((result1.upload + result2.upload + result3.upload) / 3 * 1000) / 1000,
    download: Math.round((result1.download + result2.download + result3.download) / 3 * 1000) / 1000
  };
}

function runSpeedTest(addresses) {
  if (!addresses) {
    addresses = SPEED_TEST_ADDRESSES.slice();
  }

  const address = addresses.shift();
  if (!address) return Promise.reject(new Error(`Couldn't connect to speed test server`));

  return Promise
  .fromCallback(callback => {
    const url = `ws://${address}:${process.env.SPEED_TEST_PORT}`;
    const client = new Client({ url });
    client.test(callback);
  })
  .then(({ upload, download }) => {
    return {
      upload: parseFloat(upload),
      download: parseFloat(download)
    };
  })
  .catch((err) => {
    debug(`Failed speed test: ${err.message}`);
    return speedTest(addresses);
  });
}


