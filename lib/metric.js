const prom = require('prom-client')
const http = require('http')
const responseTime = require('response-time')

var metric = {
  https_hits: new prom.Counter('app_https_hits', 'Number of https requests received', ['hostname', 'path']),
  respTime: new prom.Summary('app_https_response_time_ms', 'reponse time in ms', ['hostname', 'path'])
}

module.exports = {hits, respTime, server}

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

function server (config) {
  var server = http.createServer(function (req, res) {
    res.end(prom.register.metrics())
  })

  server.listen(config.ports.metrics || 8089)
}

