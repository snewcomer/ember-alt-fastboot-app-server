'use strict';

const ClusterWorker = require('../backing-classes/cluster-worker');
const worker = new ClusterWorker();

// fastify register of static plugin is async
(async function () {
  await worker.start();
})();
