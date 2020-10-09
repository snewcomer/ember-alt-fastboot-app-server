const compression = require('compression');

/**
 * Compression is presently stateless, so this is a very simply middleware.
 *
 * @method compressionMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @private
 */
module.exports = function compressionMiddlewareFactory(worker) {
  worker.addMiddleware({
    name: 'compression',
    value: compression(),
    before: 'basic-auth'
  });
}
