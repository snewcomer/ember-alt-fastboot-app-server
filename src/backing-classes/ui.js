'use strict';

const chalk = require('chalk');
const cluster = require('cluster');

/**
 * The UI class provides helper functions for consistent console UI output.
 * This can be overridden to provide custom logging behavior.
 *
 * @class UI
 * @private
 */
class UI {

  /**
   * Create a prefix for the UI so you can identify the source of the log.
   *
   * @constructor
   */
  constructor() {
    let type = cluster.isMaster ? 'm' : 'w';
    this.pid = `${type}${process.pid}`;
  }

  writeLine() {
    let args = Array.prototype.slice.apply(arguments);
    args.unshift('blue');

    this._write.apply(this, args);
  }

  writeWarn(message) {
    console.log(this._warnPrefix() + chalk.yellow(message));
  }

  writeError(message) {
    console.log(this._errorPrefix() + chalk.red(message));
  }

  _write() {
    let args = Array.prototype.slice.apply(arguments);
    let color = args.shift();

    if (args[0] !== null || args[0] !== undefined) {
      args[0] = this._prefix(color) + args[0];
    }

    console.log.apply(console, args);
  }

  _prefix() {
    let timestamp = chalk.bgBlue.white(this._timestamp());
    let pid = chalk.blue(this._pid());

    return `${timestamp}${pid} `;
  }

  _warnPrefix() {
    let timestamp = chalk.bgYellow.black(this._timestamp());
    let pid = chalk.yellow(this._pid());

    return `${timestamp}${pid} `;
  }

  _errorPrefix() {
    let timestamp = chalk.bgRed.white(this._timestamp());
    let pid = chalk.red(this._pid());

    return `${timestamp}${pid} `;
  }

  _timestamp() {
    return `[${(new Date()).toISOString()}]`;
  }

  _pid() {
    return this.pid ? `[${this.pid}]` : '';
  }
}


module.exports = UI;
