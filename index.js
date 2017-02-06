#!/usr/bin/env node

var manager = require('./lib/manager')

run()
function run () {
  if (process.argv[2]) {
    return usage()
  }

  // start server
  manager.start()
}

function usage () {
  console.log(`dathttpd - starts the server
Env Vars:
   DATHTTPD_CONFIG=~/dathttpd.yml - location of the config file`)
}