'use strict';

var path = require('path');
const FastBootAppServer = require('../../src/backing-classes/cluster-master');

var server = new FastBootAppServer({
  distPath: path.resolve(__dirname, './basic-app'),
  host: 'localhost',
  port: '3000',
  buildSandboxGlobals(globals) {
    return Object.assign({}, globals);
  },
});

server.start();
