const basicAuth = require('basic-auth');

/**
 * The BasicAuthMiddleware class provides a stateful wrapper around `basic-auth`.
 *
 * @class BasicAuthMiddleware
 * @private
 */
class BasicAuthMiddleware {

  /**
   * The constructor sets the state in a reachable scope for the middleware.
   *
   * @constructor
   * @param {String} username The username for auth.
   * @param {String} password The password for auth.
   */
  constructor(username, password) {
    this.username = username;
    this.password = password;
  }

  /**
   * The middleware method should be called, bound, by express.
   * @method middleware
   */
  middleware(req, res, next) {
    let user = basicAuth(req);

    if (!user || user.name !== this.username || user.pass !== this.password) {
      res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
      return res.sendStatus(401);
    }

    // This must return `next()` or express will error.
    return next();
  }
}

/**
 * @method basicAuthMiddlewareFactory
 * @param {Worker} worker The worker which will need to manage this middleware.
 * @param {String} username The username for auth.
 * @param {String} password The password for auth.
 */
module.exports = function basicAuthMiddlewareFactory(worker, username, password) {
  const basicAuth = new BasicAuthMiddleware(username, password);

  // TODO: Allow for the username to change.

  worker.addMiddleware({
    name: 'basic-auth',
    value: basicAuth.middleware.bind(basicAuth),
    before: 'master-error'
  });
};
