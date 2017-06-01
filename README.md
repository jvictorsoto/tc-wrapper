# tc-wrapper

Wrapper & parser of linux tc command (traffic control).

Allow setting, consulting and deleting rules of delay, jitter, bandwidth and corruption

## Installation

This module is installed via npm:

```
npm install --save tc-wrapper
```

## Usage

WORK IN PROGRESS NOT USABLE YET

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