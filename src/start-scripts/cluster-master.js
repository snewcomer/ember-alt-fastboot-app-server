'use strict';

// this file is currently unused. the backing class is imported and configured by app directly
const Connecter = require('../backing-classes/connector');
const FastBootServer = require('../backing-classes/cluster-master');

const config = {
  connector: new Connecter(),
  host: 'localhost',
  port: '4200',
  workerCount: 1
};

const master = new FastBootServer(config);

master.start();
