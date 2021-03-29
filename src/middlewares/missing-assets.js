'use strict';

/**
 * Missing Assets is presently stateless, so this is a very simply middleware.
 *
 * @method missingAssetsMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @private
 */
module.exports = function missingAssetsMiddlewareFactory(worker) {
  worker.addMiddleware({
    name: 'missing-assets',
    value: {
      method: 'GET',
      path: '/assets/*',
      callback(req, res) {
        return res.sendStatus(404);
      }
    }
  })
};
