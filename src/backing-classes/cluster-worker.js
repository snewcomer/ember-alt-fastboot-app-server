'use strict';

const EventEmitter = require('events').EventEmitter;

const DAGMap = require('dag-map').default;
const express = require('express');

const UI = require('./ui');

const deserialize = require('../utils/serialization').deserialize;

/**
 * A ClusterWorker object is instantiated by the worker start script.
 *
 * It is responsible for:
 * - Providing a simple built-in way to start a vanilla worker.
 * - Setting up the baseline middlewares for the application.
 * - Manage communication between the worker and the master.
 *
 * @class ClusterWorker
 * @extends EventEmitter
 */
class ClusterWorker extends EventEmitter {

  /**
   * @constructor
   * @param {Object} argumentOptions Options passed from the worker start script.
   */
  constructor(argumentOptions = {}) {
    super();

    // Process command line arguments from ClusterMaster.
    this.forkOptions = deserialize(process.argv[2])

    // Define the enumerated options set.
    // Combination of any launch options and any directly passed options.
    const options = Object.assign({}, this.forkOptions, argumentOptions);

    this.ui = new UI();

    this.host = options.host;
    this.port = options.port;
    this.sandboxGlobals = options.sandboxGlobals;

    this.distPath = options.distPath || null;

    // Forward messages to this object.
    process.on('message', (message) => {
      this.emit(message.event, message);
    });

    // Register for events sent by the parent.
    this.on('synchronize', (distPath) => {
      this.distPath = distPath;
    });

    // Our middlewares are a topologically sorted directed acyclic graph.
    // This means that for any custom middleware you can specify `before`
    // and/or `after` to create a total ordering of the middlewares.
    this.middlewares = new DAGMap();

    // Using express for now. The API almost completely abstracts Express
    // so, save for the actualy middleware implementations, the whole thing
    // can be swapped out.
    this.app = express();
    this._started = false;

    this.loadMiddleware();
  }

  /**
   * The built-in middlewares are installed here. This hook is called by
   * the constructor which allows for complete middleware customization in the
   * cluster worker start script.
   *
   * @method loadMiddleware
   * @public
   */
  loadMiddleware() {
    // require('../middlewares/basic-auth')(this);
    require('../middlewares/compression')(this);
    require('../middlewares/master-error')(this);
    require('../middlewares/fastboot')(this, { sandboxGlobals: this.sandboxGlobals });
    require('../middlewares/missing-assets')(this);
    require('../middlewares/static-serve')(this);
  }

  /**
   * This method registers a new middleware into the DAG of middlewares
   * which allows for total ordering. This method should be called
   * on the worker in the start script.
   *
   * One pattern to make this more abstract is to create a method which receives
   * the worker as an argument and appends the middleware that it needs. That is
   * the pattern used in this library.
   *
   * @method addMiddleware
   * @param {String} middleware.name This is the name of the middleware in the DAG.
   * @param {Function} [middleware.value] An Express middleware you wish to pass to `app.use`.
   * @param {String} [middleware.value.method] The method which is used here: https://expressjs.com/en/4x/api.html#app.METHOD
   * @param {String} [middleware.value.path] The optional path which is used here: https://expressjs.com/en/4x/api.html#app.METHOD
   * @param {Function|Function[]} [middleware.value.callback] The callback(s) which are passed here: https://expressjs.com/en/4x/api.html#app.METHOD
   * @param {String|String[]} middleware.before This specifies the middlewares that this must run before.
   * @param {String|String[]} middleware.after This specifies the middlewares that this must run after.
   * @public
   */
  addMiddleware(middleware) {
    if (this._started) {
      throw new Error('Server already configured. You may not late-bind middlewares.');
    }

    const name = middleware.name;
    const value = middleware.value;
    const before = middleware.before;
    const after = middleware.after;

    this.middlewares.add(name, value, before, after);
  }

  /**
   * Run by the start script, this should be executed just once.
   * This method:
   * - Processes and registers the middlewares.
   * - Starts the express server.
   *
   * @method start
   * @returns {Promise} Promise that resolves when the server is listening.
   * @public
   */
  start() {
    this._started = true;

    this.middlewares.each((name, value) => {
      // "Missing" nodes still show up in the topsort.
      if (value === void(0)) {
        return;
      }

      if (value instanceof Function) {
        // Sugar for simplistic middlewares that are just `app.use`.
        this.app.use(value);
      } else {
        // Supports the invocation pattern for https://expressjs.com/en/4x/api.html#app.METHOD
        const method = value.method;
        const path = value.path;
        const callback = value.callback || value.callbacks;

        const args = [];

        if (path) {
          args.push(path);
        }

        if (Array.isArray(callback)) {
          args.splice(args.length, 0, ...callback);
        } else {
          args.push(callback);
        }

        this.app[method](...args);
      }
    });

    return new Promise(resolve => {
      this.app.listen(this.port, this.host, () => {
        this.ui.writeLine(`HTTP server started on ${this.port}.`);

        resolve();
      });
    }).then(() => {
      process.send({ event: 'healthy' });
    });
  }
}

module.exports = ClusterWorker;
