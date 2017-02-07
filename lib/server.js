const execa = require('execa')
const mkdirp = require('mkdirp')
const path = require('path')
const untildify = require('untildify')
const express = require('express')
const vhost = require('vhost')
const greenlockExpress = require('greenlock-express')

// constants
// =

const DAT_PATH = path.join(__dirname, '../node_modules/dat/bin/cli.js')
const DAT_REGEX = /^dat:\/\/([0-9a-f]{64})/i
const HOSTNAME_REGEX = /^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/i;

// globals
// =

var app
var server
var cfg = {}
var datProcesses = {}

// exported api
// =

exports.start = function (_cfg, cb) {
  cfg = _cfg

  if (cfg.directory) {
    cfg.directory = untildify(cfg.directory)
  } else {
    cfg.directory = path.join(os.homedir(), '.dathttpd')
  }

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

  // set up ports config
  cfg.ports.http = cfg.ports.http || 80
  cfg.ports.https = cfg.ports.https || 443

  // start server
  server = greenlockExpress.create({
    server: 'https://acme-v01.api.letsencrypt.org/directory',
    email: cfg.letsencrypt.email,
    agreeTos: cfg.letsencrypt.agreeTos,
    debug: (process.env.DEBUG == 1),
    approveDomains: Object.keys(cfg.sites),
    app
  }).listen(cfg.ports.http, cfg.ports.https)
  server.on('error', err => {
    console.error('Failed to create server')
    throw err
  })
  if (cb) {
    server.once('listening', cb)
  }
}

// helpers
// =

function createSiteApp (site) {
  var siteApp = express()
  if (site.datOnly) {
    siteApp.get('*', (req, res) => {
      res.redirect(`dat://${site.hostname}${req.url}`)
    })
  } else {
    siteApp.get('/.well-known/dat', (req, res) => {
      res.status(200).end('dat://' + site.datKey + '/\nTTL=3600')
    })
    siteApp.use(express.static(site.directory, {extensions: ['html', 'htm']}))
  }
  return siteApp
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