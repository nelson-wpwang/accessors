#!/usr/bin/env bash

# Kill the background service when this is killed
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Run our own copy of the host server so we know we are getting the latest
# code.
../server/accessor_host.py -p 35123 --disable-periodic &

# Wait for that behemouth to load before continuing
sleep 15

# Run the mocha test apps
mocha .

# Block for ctrl+c
wait
