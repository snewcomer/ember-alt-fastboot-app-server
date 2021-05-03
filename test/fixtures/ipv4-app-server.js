'use strict';

var path = require('path');
const FastBootAppServer = require('../../src/backing-classes/fastboot-server');

var server = new FastBootAppServer({
  port: 4100,
  host: '0.0.0.0',
  distPath: path.resolve(__dirname, './basic-app')
});

server.start();
