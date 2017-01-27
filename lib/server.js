const execa = require('execa')
const mkdirp = require('mkdirp')
const path = require('path')
const untildify = require('untildify')

// constants
// =

const DAT_PATH = './node_modules/dat-next/bin/cli.js'
const DAT_REGEX = /^dat:\/\/([0-9a-f]{64})/i
const HOSTNAME_REGEX = /^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/i;

// globals
// =

var cfg = {}
var datProcesses = {}

// exported api
// =

exports.start = function (_cfg, cb) {
  cfg = _cfg
  cfg.directory = untildify(cfg.directory)

  // ensure the sites dir exists
  mkdirp.sync(cfg.directory)
  console.log('Serving from', cfg.directory)

  Object.keys(cfg.sites).forEach(hostname => {
    let site = cfg.sites[hostname]
    site.hostname = hostname
    site.directory = path.join(cfg.directory, hostname)
    validateSiteCfg(site)
    mkdirp.sync(site.directory)

    // start the dat subprocess
    let p = datProcesses[hostname] = execa(DAT_PATH, [getDatKey(site.url), site.directory])
    p.catch(err => console.error('ERROR: Dat process for %s', err))
    p.once('close', (code, signal) => {
      console.log('Dat process for %s closed (%d) from signal (%s)', hostname, code, signal)
      delete datProcesses[hostname]
    })
    console.log('Serving', hostname, site.url)

    // add to the HTTPS server
    // TODO
  })
}

exports.stop = function (cb) {
  // stop the dat subprocesses
  stopAll()
  function stopAll () {
    // done?
    if (Object.keys(datProcesses).length === 0) {
      return stopServer()
    }

    // run kill
    for (var hostname in datProcesses) {
      datProcesses[hostname].kill()
    }
    setTimeout(stopAll, 100)
  }

  function stopServer () {
    // stop the HTTPS server
    // TODO
    cb()
  }
}

// helpers
// =

function validateSiteCfg (site) {
  if (!HOSTNAME_REGEX.test(site.hostname)) {
    console.log('Invalid hostname "%s".')
    throw new Error('Invalid config')
  }
  if (!DAT_REGEX.test(site.url)) {
    console.error('Invalid Dat URL "%s". URLs must have the `dat://` scheme and the "raw" 64-character hex hostname.', site.url)
    throw new Error('Invalid config')
  }
}

function getDatKey (url) {
  return DAT_REGEX.exec(url)[1]
}