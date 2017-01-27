#!/usr/bin/env node

var manager = require('./lib/manager')

run(process.argv[2])
function run (command) {

  console.log(`
dathttpd ${command} ...
`)

  try {
    // commands
    switch (command) {
      case 'start':
        // start server
        manager.start()
        break

      case 'stop':
        // stop server
        manager.stop()
        break

      case 'reload':
        // send reload signal
        manager.reload()
        break

      case 'edit':
        // start config editor
        // TODO

      default:
        usage()
    }
  } catch (e) {
    console.error(e)
  }
}

function usage () {
  console.log(`dathttpd {start|stop|reload|edit}`)
}