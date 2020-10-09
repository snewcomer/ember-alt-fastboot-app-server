'use strict';

const assert = require('assert');
const cluster = require('cluster');
const os = require('os');
const path = require('path');

const Connector = require('./connector');
const UI = require('./ui');

const serialize = require('../utils/serialization').serialize;

/**
 * A ClusterMaster object is instantiated by the server start script.
 *
 * It is responsible for:
 * - Providing a simple built-in way to start a vanilla cluster.
 * - Managing all state associated with the cluster.
 * - Propogate its state into workers.
 *
 * @class ClusterMaster
 * @public
 */
class ClusterMaster {

  /**
   * Wires up *permanent* configuration of this cluster. None of these attributes
   * should change without restarting the entirety of the application server.
   *
   * @constructor
   * @param {Object} options The permanent configuration of this cluster.
   */
  constructor(options = {}) {
    assert(options.distPath || options.connector, 'ClusterMaster must be provided with either a distPath or a connector option.');
    assert(!(options.distPath && options.connector), 'ClusterMaster must be provided with either a distPath or a connector option, but not both.');

    if (options.connector) {
      // Use the provided connector.
      // Set initial `distPath` as appropriate.
      this.connector = options.connector;
      this.distPath = this.connector.distPath || null;
      this._static = false;
    } else {
      // We received a `distPath` option.
      // Create a new, completely static connector.
      this.connector = new Connector({
        distPath: options.distPath
      });
      this.distPath = options.distPath;
      this._static = true;
    }

    this.ui = options.ui;
    if (!this.ui) {
      this.ui = new UI();
    }

    // Forward the UI object, if necessary.
    if (!this.connector.ui) {
      this.connector.ui = this.ui;
    }

    // Immutable properties of this cluster master instance.
    this.host = options.host;
    this.port = options.port;
    this.sandboxGlobals = options.sandboxGlobals;

    // Determine how many workers to spin up.
    if (options.workerCount) {
      this.workerCount = options.workerCount;
    } else if (process.env.NODE_ENV === 'test') {
      this.workerCount = 1;
    } else {
      this.workerCount = os.cpus().length;
    }

    // Flag to indicate having ever successfully started.
    this._clusterInitialized = false;
  }

  /**
   * Run once to wire up events and handle the first build.
   *
   * @method start
   * @returns {Promise}
   * @public
   */
  start() {
    // Watch for any future build.
    this.connector.on('build', this.build.bind(this));

    // If our workers fail to report back healthy on first boot fail hard.
    const forkWorkersPromise = this.forkWorkers()
      .catch((error) => {
        this.ui.writeLine(error);
        process.exit(1); // eslint-disable-line no-process-exit
      });

    // Successful forking of workers!
    // We're good to go here.
    return forkWorkersPromise.then(() => {
      this._clusterInitialized = true;
      this.ui.writeLine('Successfully initialized the cluster.');
    });
  }

  /**
   * Run when the Connector notifies us of a new build.
   *
   * @method build
   * @param {Object} data the information passed to the build event.
   * @returns {Promise}
   * @private
   */
  build(data) {
    this.ui.writeLine('Received notification that a new build exists.');

    return this.connector.download(data)
      .then((distPath) => {
        this.ui.writeLine('New build downloaded. Notifying workers to synchronize.');
        return this.synchronize(distPath);
      })
      .catch((error) => {
        this.ui.writeError('New build failed to download. Making no changes to configuration.');
        this.ui.writeLine(error);
      });
  }

  /**
   * Runs at the completion of any build upon being notified by the Connector.
   * - Updates the default configuration for newly forked workers.
   * - For already-forked workers, tells them to synchronize.
   *
   * @method synchronize
   * @param {String} distPath
   * @private
   */
  synchronize(distPath) {
    if (this.distPath === distPath) {
      this.ui.writeWarn('Your new `distPath` is identical to your previous `distPath`. Reading from a directory being written to across multiple processes is dangerous.');
    }
    this.distPath = distPath;

    // Update the default configuration for new forks.
    cluster.setupMaster(this.clusterSetupMaster());

    // Tell all of the workers to synchronize.
    this.broadcast({ event: 'synchronize', distPath });
  }

  /**
   * Invoke to send a message to all of the workers in this cluster.
   *
   * @method broadcast
   * @param {Object} message The message that you want to send to your worker.
   * @public
   */
  broadcast(message) {
    let workers = cluster.workers;

    for (let id in workers) {
      workers[id].send(message);
    }
  }

  /**
   * Called once, by `start`. This abstracts over the process of
   * spawning the initial set of workers.
   *
   * @method forkWorkers
   * @returns {Promise} A promise which resolves when all workers report healthy.
   * @private
   */
  forkWorkers() {
    let promises = [];

    cluster.setupMaster(this.clusterSetupMaster());

    for (let i = 0; i < this.workerCount; i++) {
      promises.push(this.forkWorker());
    }

    return Promise.all(promises);
  }

  /**
   * Recursively self-launching worker for a Node cluster.
   *
   * @method forkWorker
   * @returns {Promise} A promise which resolves when the worker reports that it is healthy.
   * @private
   */
  forkWorker() {
    let worker = cluster.fork(this.workerEnv());

    this.ui.writeLine(`Worker ${worker.process.pid} forked.`);

    let firstBootResolve;
    let firstBootReject;
    const firstBootPromise = new Promise((resolve, reject) => {
      firstBootResolve = resolve;
      firstBootReject = reject;
    });

    if (this._clusterInitialized) {
      firstBootResolve();
    }

    worker.on('online', () => {
      this.ui.writeLine(`Worker ${worker.process.pid} online.`);
    });

    worker.on('message', (message, ...args) => {
      worker.emit(message.event, ...args);
    });

    worker.on('healthy', () => {
      this.ui.writeLine(`Worker ${worker.process.pid} healthy.`);
      firstBootResolve();

      // Bring it up to current state.
      // This captures any downloads that occurred between fork and healthy.
      // Don't send this message if we know we have a static `distPath`.
      if (!this._static && this.distPath) {
        this.ui.writeLine(`Sending startup synchronize to healthy Worker ${worker.process.pid}.`);
        worker.send({ event: 'synchronize', distPath: this.distPath });
      }
    });

    worker.on('exit', (code, signal) => {
      let error;

      if (signal) {
        error = new Error(`Worker ${worker.process.pid} killed by signal: ${signal}`);
      } else if (code !== 0) {
        error = new Error(`Worker ${worker.process.pid} exited with error code: ${code}`);
      } else {
        error = new Error(`Worker ${worker.process.pid} exited gracefully. It should only exit when told to do so.`);
      }

      if (!this._clusterInitialized) {
        // Do not respawn for a failed first launch.
        firstBootReject(error);
      } else {
        // Do respawn if you've ever successfully been initialized.
        this.ui.writeLine(error);
        this.forkWorker();
      }
    });

    return firstBootPromise;
  }

  /**
   * Extension point to allow configuring the default fork configuration.
   *
   * @method clusterSetupMaster
   * @returns {Object} cluster.settings https://nodejs.org/api/cluster.html#cluster_cluster_settings
   * @public
   */
  clusterSetupMaster() {
    const workerOptions = {
      distPath: this.distPath,
      host: this.host,
      port: this.port,
      sandboxGlobals: this.sandboxGlobals
    };

    return {
      exec: path.join(__dirname, '../start-scripts/cluster-worker.js'),
      args: [serialize(workerOptions)]
    };
  }

  /**
   * Extension point to allow setting the `env` argument for `cluster.fork`.
   *
   * @method workerEnv
   * @returns {Object} Key/value pairs to add to worker process environment
   * @abstract
   */
  workerEnv() {
    return {};
  }
}

module.exports = ClusterMaster;
