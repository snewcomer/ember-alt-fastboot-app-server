'use strict';

const fs = require('fs');

// const path = require('path');
// const express = require('express');

/**
 * The StaticServeMiddleware class provides a stateful wrapper around `express.static`.
 *
 * @class StaticServeMiddleware
 * @private
 */
class StaticServeMiddleware {

  /**
   * Initializes the instance's fields.
   *
   * @constructor
   * @param {UI} ui
   * @param {String} distPath The location on disk to find the application to serve.
   */
  constructor(ui, distPath) {
    this.ui = ui;
    this.distPath = distPath;

    // This is an object that uses the `distPath` as a key for storing a pointer
    // to the `express.static` instance to use.
    this.staticServer = {};
  }

  /**
   * This method is called, bound, when the worker receives a synchronize event.
   *
   * @method synchronize
   * @param {Object} message.distPath The location on disk to find the application to serve.
   */
  synchronize(message) {
    this.ui.writeLine('Static Serve Synchronizing.');
    this.distPath = message.distPath;
  }

  /**
   * The middleware method should be called, bound, by express.
   * @method middleware
   */
  middleware(req, res) {
    // If we don't know what assets to serve, send a 500.
    if (!this.distPath) {
      res.sendStatus(500);
      return;
    }

    // let delegatedStaticServe = this.staticServer[this.distPath];

    // if (!delegatedStaticServe) {
    //   delegatedStaticServe = express.static(path.join(this.distPath, 'webroot'));

    //   // Only ever keep one.
    //   this.staticServer = {
    //     [this.distPath]: delegatedStaticServe
    //   };
    // }

    if (fs.existsSync(req.url)) {
      res.sendFile(req.url);
    } else {
      res.send(new Error('404 Not Found'));
    }
  }

  errorHandler(error, req, reply) {
    reply.code(404).send(error);
  }
}

/**
 * The factory also wires events up on the middleware instance in order to
 * maintain the state of the middleware correctly.
 *
 * @method staticServeMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @private
 */
module.exports = function(worker) {
  const staticServe = new StaticServeMiddleware(worker.ui, worker.distPath);

  worker.on('synchronize', staticServe.synchronize.bind(staticServe));

  worker.addMiddleware({
    name: 'static-serve',
    value: {
      method: 'GET',
      path: '/assets/*',
      callback: staticServe.middleware.bind(staticServe),
    },
  });
};
