var mkdirp = require('mkdirp')
var path = require('path')
var os = require('os')
var untildify = require('untildify')
var express = require('express')
var vhost = require('vhost')
var http = require('http')
var greenlockExpress = require('greenlock-express')
var Multidat = require('multidat')
var toiletdb = require('toiletdb')
var ms = require('ms')
var metric = require('./metric')
var approveDomains = require('./lets-encrypt').approveDomains
var serveDir = require('serve-index')

var proxy = require('http-proxy').createProxyServer()

// constants
// =

var IS_DEBUG = (['debug', 'staging', 'test'].indexOf(process.env.NODE_ENV) !== -1)
var DAT_REGEX = /^dat:\/\/([0-9a-f]{64})/i
var HOSTNAME_REGEX = /^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$/i;

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
  Multidat(toiletdb(path.join(cfg.directory, 'multidat.json')), function (err, m) {
    if (err) {
      throw err
    }
    multidat = m
    var dats = multidat.list()

    // create server app
    app = express()

    // iterate sites
    Object.keys(cfg.sites).forEach(function (hostname) {
      var site = cfg.sites[hostname]
      site.hostname = hostname
      validateSiteCfg(site)

      if (site.url) {
        // a dat site
        site.datKey = getDatKey(site.url)
        site.directory = path.join(cfg.directory, hostname)
        mkdirp.sync(site.directory)

        // start the dat
        var dat = dats.find(function (d) { return d.key.toString('hex') === site.datKey })
        if (dat) {
          initDat(null, dat)
        } else {
          multidat.create(site.directory, {key: site.datKey}, initDat)
        }
        function initDat (err, dat) {
          if (err) {
            throw err
          }
          dat.joinNetwork()
          metric.trackDatStats(dat, site)
          console.log('Serving', hostname, site.url)
        }
      } else if (site.proxy) {
        console.log('Proxying', hostname, site.proxy)
      } else if (site.redirect) {
        // remove trailing slash
        site.redirect = site.redirect.replace(/\/$/, '')
        console.log('Redirecting', hostname, site.redirect)
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
        app: app
      }).listen(cfg.ports.http, cfg.ports.https)
    } else {
      server = http.createServer(app)
      server.listen(cfg.ports.http)
    }
    server.on('error', function (err) {
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
    siteApp.get('/.well-known/dat', function (req, res) {
      res.status(200).end('dat://' + site.datKey + '/\nTTL=3600')
    })
    if (site.datOnly) {
      siteApp.get('*', function (req, res) {
        res.redirect('dat://' + site.hostname + req.url)
      })
    } else {
      var setHeaders = function (res) {
        if (site.hsts) {
          var maxAge = ms(site.hsts === true ? '7d' : site.hsts)
          res.setHeader('Strict-Transport-Security', 'max-age=' + maxAge)
        }
      }
      siteApp.use(express.static(site.directory, {extensions: ['html', 'htm'], setHeaders: setHeaders}))
      siteApp.use(serveDir(site.directory, {icons: true}));
    }
  } else if (site.proxy) {
    // proxy site
    siteApp.all('*', function (req, res) {
      proxy.web(req, res, {target: site.proxy})
    })
  } else if (site.redirect) {
    siteApp.all('*', function (req, res) {
      res.redirect(site.redirect + req.url)
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
  if (!site.url && !site.proxy && !site.redirect) {
    console.log('Invalid config for "%s", must have a url, proxy or redirect configured.', site.hostname)
    throw new Error('Invalid config')
  }
}

function getDatKey (url) {
  return DAT_REGEX.exec(url)[1]
}
