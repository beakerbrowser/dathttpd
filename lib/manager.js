const fs = require('fs')
const yaml = require('js-yaml')
const server = require('./server')
const metric = require('./metric')

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
  let configContents
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
