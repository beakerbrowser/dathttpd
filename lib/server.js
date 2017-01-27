const execa = require('execa')
const mkdirp = require('mkdirp')
const path = require('path')
const untildify = require('untildify')
const express = require('express')
const vhost = require('vhost')

// constants
// =

const DAT_PATH = './node_modules/dat-next/bin/cli.js'
const DAT_REGEX = /^dat:\/\/([0-9a-f]{64})/i
const HOSTNAME_REGEX = /^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/i;

// globals
// =

var app
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

  // create server app
  app = express()

  // iterate sites
  Object.keys(cfg.sites).forEach(hostname => {
    let site = cfg.sites[hostname]
    site.hostname = hostname
    site.directory = path.join(cfg.directory, hostname)
    validateSiteCfg(site)
    site.datKey = getDatKey(site.url)
    mkdirp.sync(site.directory)

    // start the dat subprocess
    let p = datProcesses[hostname] = execa(DAT_PATH, [site.datKey, site.directory])
    p.catch(err => console.error('ERROR: Dat process for %s', err))
    p.once('close', (code, signal) => {
      console.log('Dat process for %s closed (%d) from signal (%s)', hostname, code, signal)
      delete datProcesses[hostname]
    })
    console.log('Serving', hostname, site.url)

    // add to the HTTPS server
    app.use(vhost(hostname, createSiteApp(site)))
  })

  // start server
  app.listen(80, err => {
    if (err) {
      console.error('Failed to create HTTPS server')
      throw err
    }
    cb && cb(err)
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
    app.close(cb)
  }
}

// helpers
// =

function createSiteApp (site) {
  var app = express()
  if (site.datOnly) {
    app.get('*', (req, res) => {
      res.redirect(`dat://${site.hostname}${req.url}`)
    })
  } else {
    app.get('/.well-known/dat', (req, res) => {
      res.status(200).end('dat://' + site.datKey + '/\nTTL=3600')
    })
    app.use(express.static(site.directory))
  }
  return app
}

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