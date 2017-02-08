const prom = require('prom-client')
const http = require('http')

var metric = {
  https_hits: new prom.Counter('app_https_hits', 'Number of https requests received', ['hostname'])
}

module.exports = {middleware, server}

function middleware (site) {
  return (req, res, next) => {
    metric.https_hits.inc({hostname: site.hostname})

    next()
  }
}

function server (config) {
  var server = http.createServer(function (req, res) {
    res.end(prom.register.metrics())
  })

  server.listen(config.ports.metrics || 8089)
}

