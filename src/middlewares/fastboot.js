// Forked from https://github.com/ember-fastboot/fastboot-express-middleware/blob/30ff3a3/src/index.js
// Original code licensed under the MIT license.

const path = require('path');
const FastBoot = require('fastboot');
// const { minify_html } = require('../utils/html_whitespace');

/**
 * The FastBootMiddleware class provides a stateful wrapper around `fastboot`.
 *
 * @class FastBootMiddleware
 */
class FastBootMiddleware {

  /**
   * This initializes the class fields.
   * If there is a `distPath` available, it initializes FastBoot.
   *
   * @constructor
   * @param {UI} ui
   * @param {String} distPath The location on disk to find the application to serve.
   * @param {Object} options
   */
  constructor(ui, distPath, options) {
    this.ui = ui;
    this.fastboot = null;
    this.options = options;
    this.distPath = distPath;

    if (distPath) {
      this.initFastBoot(Object.assign({ distPath }, this.options));
    }
  }

  /**
   * This method is called any time that this middleware needs FastBoot, but does not have it.
   *
   * @method initFastBoot
   * @param {Object} options The options to pass to FastBoot itself.
   */
  initFastBoot(options) {
    this.ui.writeLine('Initializing FastBoot.');

    try {
      this.fastboot = new FastBoot(options);
    } catch (error) {
      // Do nothing.
    }
  }

  /**
   * This method is called, bound, when the worker receives a synchronize event.
   *
   * @method synchronize
   * @param {Object} message.distPath The location on disk to find the application to serve.
   */
  synchronize(message) {
    if (!this.fastboot) {
      this.initFastBoot(Object.assign({ distPath: message.distPath }, this.options));
    }

    if (this.fastboot) {
      this.ui.writeLine('FastBoot Synchronizing.');
      this.fastboot.reload({ distPath: message.distPath });
    }
  }

  /**
   * The middleware method should be called, bound, by express.
   * @method middleware
   */
  middleware(req, reply) {
    // If we don't have a valid FastBoot instance, send a 500.
    if (!this.fastboot) {
      reply.sendStatus(500);
      return;
    }

    if (process.env.FASTBOOT_DISABLED || req.query.fastboot === 'false') {
      reply.sendFile('index.html', { root: path.join(this.distPath, 'webroot') })
    } else {
      this.fastboot.visit(req.url, { request: req, response: reply })
        .then(
          result => this.success(result, req, reply),
          error => this.failure(error, req, reply)
        );
    }
  }

  /**
   * Extracted success handler for `fastboot.visit`.
   *
   * @param {*} result
   * @param {*} req
   * @param {*} reply
   * @public
   */
  success(result, req, reply) {
    let path = req.url;

    // let responseBody = opts.chunkedResponse ? result.chunks() : result.html();
    let responseBody = result.html();

    responseBody.then(body => {
      let headers = result.headers;
      let statusMessage = result.error ? 'NOT OK ' : 'OK ';

      for (var pair of headers.entries()) {
        reply.set(pair[0], pair[1]);
      }

      if (result.error) {
        this.ui.writeLine('RESILIENT MODE CAUGHT:', result.error.stack);
        // res.(result.error);
      }

      this.ui.writeLine(result.statusCode, statusMessage + path);
      reply.status(result.statusCode);

      if (typeof body === 'string') {
        reply.type('text/html');
        reply.send(body);
      } else if (result.error) {
        reply.send(body[0]);
      } else {
        body.forEach(chunk => reply.write(chunk));
        reply.end();
      }
    })
    .catch(error => {
      reply.statusCode(500);
      reply.send(error);
    });
  }

  /**
   * Extracted failure handler for `fastboot.visit`.
   *
   * @param {*} result
   * @param {*} req
   * @param {*} reply
   * @public
   */
  failure(error, req, reply) {
    if (error.name === 'UnrecognizedURLError') {
      reply.send(error);
    } else {
      reply.statusCode(500);
      reply.send(error);
    }
  }
}

/**
 * The factory also wires events up on the middleware instance in order to
 * maintain the state of the middleware correctly.
 *
 * It creates and registers *two* middlewares.
 *
 * @method fastBootMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @param {Object} options Options to pass to the FastBoot instance.
 * @private
 */
module.exports = function fastBootMiddlewareFactory(worker, options) {
  const fastBootMiddleware = new FastBootMiddleware(worker.ui, worker.distPath, options);

  worker.on('synchronize', fastBootMiddleware.synchronize.bind(fastBootMiddleware));

  worker.addMiddleware({
    name: 'fastboot-root',
    value: {
      method: 'GET',
      path: '/',
      callback: fastBootMiddleware.middleware.bind(fastBootMiddleware)
    },
    before: 'static-serve'
  });

  // worker.addMiddleware({
  //   name: 'fastboot-glob',
  //   value: {
  //     method: 'GET',
  //     path: '/*',
  //     callback: fastBootMiddleware.middleware.bind(fastBootMiddleware)
  //   },
  //   after: 'missing-assets'
  // });
}
