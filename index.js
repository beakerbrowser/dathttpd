#!/usr/bin/env node
const os = require('os')
const path = require('path')
const manager = require('./lib/manager')

const defaultConfigPath = process.env.DATHTTPD_CONFIG || path.join(os.homedir(), '.dathttpd.yml')

const argv = require('yargs')
  .usage('dathttpd - Start a dathttpd server')
  .option('config', {
    describe: 'Path to the config file. If no path is given, the path to the config is looked up in the DATHTTPD_CONFIG environment variable. If this is not set, the config will be read from the default path ~/.dathttpd.yml.',
    default: defaultConfigPath,
  })
  .argv

run()
function run () {
  const configPath = argv.config
  // start server
  manager.start(configPath)
}