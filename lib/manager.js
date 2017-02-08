const os = require('os')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const server = require('./server')
const metric = require('./metric')

// constants
// =

const CFG_PATH = process.env.CONFIG || path.join(os.homedir(), '.dathttpd.yml')

// exported api
// =

exports.start = function () {
  // read config and start the server
  var config = readConfig()
  server.start(config)
  metric.server(config)
}

// internal helpers
// =

function readConfig () {
  let cfgRaw
  try {
    cfgRaw = fs.readFileSync(CFG_PATH, 'utf8')
  } catch (e) {
    console.error('Failed to load config file at', CFG_PATH)
    throw e
  }
  try {
    return yaml.safeLoad(cfgRaw)
  } catch (e) {
    console.error('Failed to parse config file at', CFG_PATH)
    throw e
  }
}
