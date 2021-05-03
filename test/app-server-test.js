"use strict";

const path              = require('path');
const fork              = require('child_process').fork;
const expect            = require('chai').expect;
const FastBootAppServer = require('../src/backing-classes/fastboot-server');
const request           = require('request-promise-native').defaults({ simple: false, resolveWithFullResponse: true });

let server;

describe("FastBootAppServer", function() {
  this.timeout(3000);

  afterEach(function() {
    if (server) {
      server.kill();
    }
  });

  it("throws if no distPath or connector is provided", function() {
    expect(() => {
      new FastBootAppServer();
    }).to.throw(/must be provided with either a distPath or a connector/);
  });

  it("throws if both a distPath and connector are provided", function() {
    expect(() => {
      new FastBootAppServer({
        connector: {},
        distPath: 'some/dist/path'
      });
    }).to.throw(/FastBootServer must be provided with either a distPath or a connector option, but not both/);
  });

  it("serves an HTTP 500 response if the app can't be found", function() {
    return runServer('not-found-server')
      .then(() => request('http://localhost:3000'))
      .then(response => {
        expect(response.statusCode).to.equal(500);
        expect(response.body).to.match(/Internal Server Error/);
      });
  });

  it("serves static assets", function() {
    return runServer('basic-app-server')
      .then(() => request('http://localhost:3000/assets/fastboot-test.js'))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('"use strict";');
      })
      .then(() => request('http://localhost:3000/'))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("returns a 404 status code for non-existent assets",  function() {
    return runServer('basic-app-server')
      .then(() => request('http://localhost:3000/assets/404-does-not-exist.js'))
      .then(response => {
        expect(response.statusCode).to.equal(404);
        expect(response.body).to.match(/Not Found/);
      })
      .then(() => request('http://localhost:3000/'))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it.skip("returns a 401 status code for non-authenticated request", function() {
    return runServer('auth-app-server')
      .then(() => request('http://localhost:3000/'))
      .then(response => {
        expect(response.statusCode).to.equal(401);
        expect(response.headers['www-authenticate']).equal('Basic realm=Authorization Required');
      })
      .then(() => request({ uri: 'http://localhost:3000/', headers: { 'Authorization': 'Basic dG9tc3Rlcjp6b2V5'  }}))
      .then(response => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("responds with fastboot=false query param", function() {
    return runServer('basic-app-server')
      .then(() => request('http://localhost:3000?fastboot=false'))
      .then((response) => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('<!-- EMBER_CLI_FASTBOOT_BODY -->');
      });
  });

  it("responds on the configured host and port", function() {
    return runServer('ipv4-app-server')
      .then(() => request('http://127.0.0.1:4100/'))
      .then((response) => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });

  it("allows changing of distpath", function() {
    return runServer('dist-path-change-server')
      .then(() => request('http://localhost:3000'))
      .then((response) => {
        expect(response.statusCode).to.equal(200);
        expect(response.body).to.contain('Welcome to Ember');
      });
  });
});

function runServer(name) {
  return new Promise((res, rej) => {
    let serverPath = path.join(__dirname, 'fixtures', `${name}.js`);
    server = fork(serverPath, {
      silent: true
    });

    server.on('error', rej);

    server.stdout.on('data', data => {
      if (data.toString().match(/Successfully initialized the cluster/)) {
        res();
      }
    });

    server.stderr.on('data', data => {
      console.log(data.toString());
    });

    server.stdout.on('data', data => {
      console.log(data.toString());
    });
  });
}
