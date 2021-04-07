const compression = require('compression');

/**
 * Compression is presently stateless, so this is a very simply middleware.
 * https://github.com/expressjs/compression
 * Header is sent with 'Content-Encoding: gzip'
 *
 * @method compressionMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @private
 */
module.exports = function compressionMiddlewareFactory(worker) {
  worker.addMiddleware({
    name: 'compression',
    value: compression(),
    before: 'fastboot'
  });
}
