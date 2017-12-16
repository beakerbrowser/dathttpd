#!/usr/bin/env node
const os = require('os')
const path = require('path')
const manager = require('./lib/manager')

run()
function run () {
  let configPath
  if (process.argv.length === 3) {
    configPath = process.argv[2]
  } else if (process.argv.length === 2) {
    configPath = process.env.DATHTTPD_CONFIG || path.join(os.homedir(), '.dathttpd.yml')
  } else {
    return usage()
  }

  // start server
  manager.start(configPath)
}

function usage () {
  console.log(`Usage: dathttpd [<config>]
Starts a server with a config file at the path <config>.

If no path is given, the path to the config is looked up in the
DATHTTPD_CONFIG environment variable. If this is not set, the config
will be read from the default path ~/.dathttpd.yml.

Env vars:
   DATHTTPD_CONFIG=~/dathttpd.yml - location of the config file`)
}