'use strict';

const FastBootAppServer = require('../../src/backing-classes/cluster-master');

var server = new FastBootAppServer({
  host: 'localhost',
  port: '3000',
  connector: {
    on() {},
    download() {
      return Promise.resolve();
    }
  }
});

server.start();
