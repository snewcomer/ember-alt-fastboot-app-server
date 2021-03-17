'use strict';

const ClusterWorker = require('../backing-classes/cluster-worker');
const worker = new ClusterWorker();
// worker.start();
(async function () { await worker.start()})();
