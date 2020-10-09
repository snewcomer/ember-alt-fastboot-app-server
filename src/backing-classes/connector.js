'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * Connector is used to communicate between any external sources
 * and the ClusterMaster instance. It is a generic EventEmitter with
 * just one default event. Customization of this is expected in most
 * cases.
 *
 * @class Connector
 * @extends EventEmitter
 */
class Connector extends EventEmitter {

  /**
   * The constructor wires up the only default listener.
   *
   * @constructor
   * @param {String} options.distPath The location on disk to find the application to serve.
   */
  constructor(options = {}) {
    super();

    this.distPath = options.distPath || null;

    this.on('build', (distPath) => {
      this.distPath = distPath;
    });
  }

  /**
   * The `build` event must be emitted by something else *on* the Connector object.
   * It is not emitted by default.
   *
   * @event build
   * @type {Object}
   */

  /**
   * The download method implemented here supports a static `distPath` for the application.
   * This should be customized for the behavior your application needs.
   *
   * @method download
   * @returns {Promise<String>} Promise which resolves to a string matching the location on disk to find the application to serve.
   * @abstract
   */
  download() {
    return Promise.resolve(this.distPath);
  }
}

module.exports = Connector;
