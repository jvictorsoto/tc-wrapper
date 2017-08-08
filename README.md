# tc-wrapper

Wrapper & parser of linux tc command (traffic control).

Allow setting, consulting and deleting rules of delay, jitter, bandwidth and corruption

## Installation

This module is installed via npm:

```
npm install --save tc-wrapper
```

## Changelog

  * 1.0.8: Removed network parameter and included srcNetwork & dstNetwork paramenters

## Usage

The library export a instantiable class that has three major methods: ```del```, ```get``` and ```set```, for deleting, fetching and setting tc rules.
Keep in mind that ```set``` method will call ```del``` before execute, so it will clean all the rules before aplying the new ones.

**Allowed targeting**

Currently tc-wrapper only supports ip traffic, and can match by network, src and dst ports.

**Allowed modificators**

* **rate**: Bandwith limitation, htb algorith will be used, tbf is not supported (yet).
* **delay**: Round trip time of packets, will be added as **additional** time.
* **jitter**: Delay variation normal-distributed.
* **loss**: Packet loss, in percentage.
* **corrupt**: Packet corruption, in percentage.


### Clean all rules for *eth0*

```js
import TCWrapper from 'tc-wrapper';

const tcWrapper = new TCWrapper('eth0');

tc.Wrapper.get().then((rules) => {
  /* rules looks like:
  {
    "outgoing": {
      "srcNetwork=0.0.0.0/0,protocol=ip": {
        "delay": "1.0ms",
        "jitter": "0.5%",
        "loss": "3%",
        "corrupt": "2%",
        "rate": "10Mbit"
      }
    },
    "incoming": {
      "dstNetwork=192.168.1.1/32,protocol=ip": {
        "loss": "9%",
      },
      "dstNetwork=192.168.1.1/32,srcNetwork=10.10.10.0/28,srcPort=80,protocol=ip": {
        "rate": "100Mbit",
      }
    }
  }
  */
});
```

### Increase output packets Round Trip Time by 20 ms

```js
import TCWrapper from 'tc-wrapper';

const tcWrapper = new TCWrapper('eth0');

const myRules = {
  outgoing: {
    'dstNetwork=0.0.0.0/0,protocol=ip':{
      delay: '20ms'
    }
  }
};

tc.Wrapper.set(myRules).then((rules) => {
  // Rules set!
});

```

### Limit incoming bandwith of *eth0* to 20 Mbit

```js
import TCWrapper from 'tc-wrapper';

const tcWrapper = new TCWrapper('eth0');

const myRules = {
  incoming: {
    'srcNetwork=0.0.0.0/0,protocol=ip':{
      rate: '20Mbit'
    }
  }
};

tc.Wrapper.set(myRules).then((rules) => {
  // Rules set!
});

```


## Enable debug of module

This module uses [debug](https://www.npmjs.com/package/debug) for debugging, you can enable debug messages of all modules with:

```
DEBUG=tc-wrapper*
```

Each module has custom debug label. Example:

```
DEBUG=tc-wrapper:TCfilterParser
```

Will only show debug messages about TCfilterParser module.

## Run tests

```
npm test
```

## License (MIT)

In case you never heard about the [MIT license](http://en.wikipedia.org/wiki/MIT_license).

See the [LICENSE file](LICENSE) for details.