const prom = require('prom-client')
const http = require('http')
const responseTime = require('response-time')

var metric = {
  https_hits: new prom.Counter('app_https_hits', 'Number of https requests received', ['hostname', 'path']),
  respTime: new prom.Summary('app_https_response_time_ms', 'Response time in ms', ['hostname', 'path']),
  datUploadSpeed: new prom.Gauge('app_dat_upload_speed', 'Bytes uploaded per second', ['archive']),
  datDownloadSpeed: new prom.Gauge('app_dat_dowload_speed', 'Bytes downloaded per second', ['archive']),
  datPeers: new prom.Gauge('app_dat_peers', 'Number of peers on the network', ['archive']),
}

module.exports = {hits, respTime, trackDatStats, server}

function hits (site) {
  return (req, res, next) => {
    metric.https_hits.inc({hostname: site.hostname, path: req.path})

    next()
  }
}

function respTime (site) {
  return responseTime(function (req, res, time) {
    metric.respTime.labels(site.hostname, req.path).observe(time)
  })
}

function trackDatStats (dat) {
  var key = dat.key.toString('hex')
  var stats = dat.trackStats()
  setInterval(function () {
    metric.datUploadSpeed.labels(key).set(stats.network.uploadSpeed)
    metric.datDownloadSpeed.labels(key).set(stats.network.downloadSpeed)
    metric.datPeers.labels(key).set(dat.network.connected)
  }, 500)
}

function server (config) {
  var server = http.createServer(function (req, res) {
    res.end(prom.register.metrics())
  })

  server.listen(config.ports.metrics || 8089)
}

