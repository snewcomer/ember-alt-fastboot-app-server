'use strict';

const path = require('path');
const FastBootAppServer = require('../../src/backing-classes/cluster-master');
const Connector = require('../../src/backing-classes/connector');

const connector = new Connector({
  distPath: path.resolve(__dirname, './basic-app')
});

var server = new FastBootAppServer({
  host: 'localhost',
  port: '3000',
  connector: connector
});

const serverPromise = server.start();

// Don't run this on worker threads.
if (serverPromise) {
  serverPromise.then(() => {
    connector.emit('build', path.resolve(__dirname, './new-dist-app'));
  });
}
