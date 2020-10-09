'use strict';

/**
 * In the event that the cluster master informs a worker of an error, this middleware
 * runs in order to present the contents of that error message.
 *
 * The message is saved in a reachable scope, and if not present, this middleware is a no-op.
 *
 * @class MasterErrorMiddleware
 * @private
 */
class MasterErrorMiddleware {

  /**
   * Initializes the instance's fields.
   * @constructor
   */
  constructor() {
    this.message = null;
  }

  /**
   * Called on the occurrence of an error in the cluster master, sets the error message for the middleware.
   *
   * @method error
   * @param {String} error.response The HTML error message to display to the user.
   */
  error(error) {
    this.message = error.response;
  }

  /**
   * Any time the cluster master sends a synchronize event we know that the cluster has recovered.
   *
   * @method synchronize
   */
  synchronize() {
    this.message = null;
  }

  /**
   * The middleware method should be called, bound, by express.
   * @method middleware
   */
  middleware(req, res, next) {
    if (this.message) {
      res.status(500);
      res.type('text/html');
      res.send(this.message);
    } else {
      return next();
    }
  }
}

/**
 * The factory also wires events up on the middleware instance in order to
 * maintain the state of the middleware correctly.
 *
 * @method masterErrorMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @private
 */
module.exports = function masterErrorMiddlewareFactory(worker) {
  const masterError = new MasterErrorMiddleware();

  worker.on('masterError', masterError.error.bind(masterError));
  worker.on('synchronize', masterError.synchronize.bind(masterError));

  worker.addMiddleware({
    name: 'master-error',
    value: masterError.middleware.bind(masterError),
    after: 'basic-auth',
    before: 'fastboot-root'
  });
};
