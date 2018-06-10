#!/usr/bin/env bash

set -e

function clean_up {
  kill -9 ${pid} 2>&1 >/dev/null
  exit
}
trap clean_up EXIT

# get potential local ips of this machine to allow container-host connections
SPEED_TEST_ADDRESSES=$(node -p 'ifs = require("os").networkInterfaces();JSON.stringify(Object.keys(ifs).reduce((b, i) => (ifs[i].forEach(ii => ii.family === "IPv4" && !ii.internal && b.push(ii.address)), b), []))')
SPEED_TEST_PORT=30300

node_modules/.bin/myspeed server ${SPEED_TEST_PORT} > /dev/null &
pid=$!

CMD="node_modules/.bin/mocha e2e/**/*.e2e.js"
if [[ $1 ]]; then
  CMD="sh"
fi

docker stop tc-wrapper 2>&1 > /dev/null && docker rm tc-wrapper 2>&1 > /dev/null || true
docker build -q -t tc-wrapper --file e2e/Dockerfile .

sleep 5
docker run -t \
--rm \
--cap-add=NET_ADMIN \
-e "SPEED_TEST_PORT=${SPEED_TEST_PORT}" \
-e "DEBUG=${DEBUG:-tc-wrapper*}" \
-e "SPEED_TEST_ADDRESSES=${SPEED_TEST_ADDRESSES}" \
--name tc-wrapper \
tc-wrapper ${CMD}

clean_up
