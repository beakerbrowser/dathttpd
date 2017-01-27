const npid = require('npid')
const os = require('os')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')
const server = require('./server')

// constants
// =

const PIDFILE_PATH = path.join(os.homedir(), '.dathttpd.pid')
const CFG_PATH = process.env.CONFIG || path.join(os.homedir(), '.dathttpd.yml')

// exported api
// =

exports.start = function () {
  // setup pidfile
  try {
    const pidFile = npid.create(PIDFILE_PATH)
    pidFile.removeOnExit()
  } catch (e) {
    throw new Error('dathttpd is already running')
  }

  // install signal listeners
  process.on('SIGHUP', () => {
    console.log('Received SIGHUP. Reloading ...')
    server.stop(() => server.start(readConfig()))
  })
  process.on('SIGINT', () => {
    console.log('Received SIGINT. Closing ...')
    process.exit(0)
  })

  // read config and start the server
  server.start(readConfig())
}

exports.stop = function () {
  // find and sigint the server process
  const pid = getPid()
  process.kill(pid, 'SIGINT')
}

exports.reload = function () {
  // find and sighup the server process
  const pid = getPid()
  process.kill(pid, 'SIGHUP')
}

// internal helpers
// =

function getPid () {
  try {
    return fs.readFileSync(PIDFILE_PATH, 'utf8')
  } catch (e) {
    throw new Error('dathttpd is not running')
  }
}

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
