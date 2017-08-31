const mkdirp = require('mkdirp')
const path = require('path')
const os = require('os')
const untildify = require('untildify')
const express = require('express')
const vhost = require('vhost')
const http = require('http')
const greenlockExpress = require('greenlock-express')
const Multidat = require('multidat')
const toiletdb = require('toiletdb')
const ms = require('ms')
const metric = require('./metric')
const {approveDomains} = require('./lets-encrypt')
const serveDir = require('serve-index')

const proxy = require('http-proxy').createProxyServer()

// constants
// =

const IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)
const DAT_PATH = path.join(__dirname, '../node_modules/dat/bin/cli.js')
const DAT_REGEX = /^dat:\/\/([0-9a-f]{64})/i
const HOSTNAME_REGEX = /^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/i;

// globals
// =

var app
var server
var multidat
var cfg = {}

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

  // create multidat
  Multidat(toiletdb(path.join(cfg.directory, 'multidat.json')), (err, m) => {
    if (err) throw err
    multidat = m
    var dats = multidat.list()

    // create server app
    app = express()

    // iterate sites
    Object.keys(cfg.sites).forEach(hostname => {
      let site = cfg.sites[hostname]
      site.hostname = hostname
      validateSiteCfg(site)

      if (site.url) {
        // a dat site
        site.datKey = getDatKey(site.url)
        site.directory = path.join(cfg.directory, hostname)
        mkdirp.sync(site.directory)

        // start the dat
        var dat = dats.find(d => d.key.toString('hex') === site.datKey)
        if (dat) {
          initDat(null, dat)
        } else {
          multidat.create(site.directory, {key: site.datKey}, initDat)
        }
        function initDat (err, dat) {
          if (err) throw err
          dat.joinNetwork()
          metric.trackDatStats(dat, site)
          console.log('Serving', hostname, site.url)
        }
      } else if (site.proxy) {
        console.log('Proxying', hostname, site.proxy)
      }

      // add to the HTTPS server
      app.use(vhost(hostname, createSiteApp(site)))
    })

    // set up ports config
    cfg.ports = cfg.ports || {}
    cfg.ports.http = cfg.ports && cfg.ports.http || 80
    cfg.ports.https = cfg.ports && cfg.ports.https || 443

    // start server
    if (cfg.letsencrypt) {
      server = greenlockExpress.create({
        server: IS_DEBUG ? 'staging' : 'https://acme-v01.api.letsencrypt.org/directory',
        debug: IS_DEBUG,
        approveDomains: approveDomains(cfg),
        app
      }).listen(cfg.ports.http, cfg.ports.https)
    } else {
      server = http.createServer(app)
      server.listen(cfg.ports.http)
    }
    server.on('error', err => {
      console.error('Failed to create server')
      throw err
    })
    if (cb) {
      server.once('listening', cb)
    }
  })
}

// helpers
// =

function createSiteApp (site) {
  var siteApp = express()
  if (site.url) {
    // dat site
    siteApp.use(metric.hits(site))
    siteApp.use(metric.respTime(site))
    siteApp.get('/.well-known/dat', (req, res) => {
      res.status(200).end('dat://' + site.datKey + '/\nTTL=3600')
    })
    if (site.datOnly) {
      siteApp.get('*', (req, res) => {
        res.redirect(`dat://${site.hostname}${req.url}`)
      })
    } else {
      const setHeaders = (res) => {
        if (site.hsts) {
          let maxAge = ms(site.hsts === true ? '7d' : site.hsts)
          res.setHeader('Strict-Transport-Security', `max-age=${maxAge}`)
        }
      }
      siteApp.use(express.static(site.directory, {extensions: ['html', 'htm'], setHeaders}))
      siteApp.use(serveDir(site.directory, {icons: true}));
    }
  } else if (site.proxy) {
    // proxy site
    siteApp.all('*', (req, res) => {
      proxy.web(req, res, {target: site.proxy})
    })
  }
  return siteApp
}

function validateSiteCfg (site) {
  if (!HOSTNAME_REGEX.test(site.hostname)) {
    console.log('Invalid hostname "%s".', site.hostname)
    throw new Error('Invalid config')
  }
  if (site.url && !DAT_REGEX.test(site.url)) {
    console.error('Invalid Dat URL "%s". URLs must have the `dat://` scheme and the "raw" 64-character hex hostname.', site.url)
    throw new Error('Invalid config')
  }
  if (!site.url && !site.proxy) {
    console.log('Invalid config for "%s", must have a url or proxy configured.', site.hostname)
    throw new Error('Invalid config')
  }
}

function getDatKey (url) {
  return DAT_REGEX.exec(url)[1]
}
