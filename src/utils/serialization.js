'use strict';

const base64 = require('base-64');

function circularReplacer() {
  const seen = new WeakSet();

  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }

      seen.add(value);
    }

    return value;
  }
}

function serialize(object) {
  return base64.encode(encodeURIComponent(JSON.stringify(object, circularReplacer())));
}

function deserialize(string) {
  return JSON.parse(decodeURIComponent(base64.decode(string)));
}

module.exports = {
  serialize,
  deserialize
};
