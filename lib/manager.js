var fs = require('fs')
var yaml = require('js-yaml')
var server = require('./server')
var metric = require('./metric')

// exported api
// =

exports.start = function (configPath) {
  // read config and start the server
  var config = readConfig(configPath)
  server.start(config)
  metric.server(config)
}

// internal helpers
// =

function readConfig (configPath) {
  var configContents
  try {
    configContents = fs.readFileSync(configPath, 'utf8')
  } catch (e) {
    console.error('Failed to load config file at', configPath)
    throw e
  }
  try {
    return yaml.safeLoad(configContents)
  } catch (e) {
    console.error('Failed to parse config file at', configPath)
    throw e
  }
}
