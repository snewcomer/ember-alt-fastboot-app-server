# ember-alt-fastboot-app-server

Note - these ideas presented here are from the brain of an unnamed person. We can thank this person.

## General Design

- Replace `express` with `fastify`.  Express is largely unmaintained.  Moreover, fastify includes HTTP2 support.  This is a direction we need to move in the Ember community.
- Cluster management.
- Being aware of distribution changes and downloading of new assets.
- Delegation of responsibilities between three separate primary objects:
  - Cluster Master (FasBootServer)
  - Cluster Workers
  - HTTP Server

## Constituent Components

The three primary objects are the components that would be required in order to build a production web server on top of Fastify/Node.js.

### Cluster Master (FastBoot Server)

This process should be responsible for setting everything up and for communicating with the workers. In general, all information regarding application state should be the responsibility of this process.

Currently there are two external facing APIs, beyond the initialization step:
- Downloader
- Notifier

The cluster master does not `fork` child processes by explicitly calling out to a separate entry point, it instead relies on the same entry point and branching in the codebase.

This results in:
- Conflation of the API between the cluster master and cluster workers which is unnecessary and confusing.
- Branching and protection in many methods.

#### Recommendations

- Create two separate entry points to the application: one for the cluster master, one for the cluster workers.
- Remove API surface area from the cluster master which is not relevant to it.
- Design API surface area for specifying the entry path for each worker.

### `Downloader`/`Notifier`

I've found that conflating these two objects is typically a more convenient API. The `Notifier` is often the one who first knows of a new asset, where to find it, and how to get it. The `Downloader` is simply a `Promise` that resolves once the asset is ready for use. It does not receive any information which means that it must have a stateful sidechannel for where to get information. That tightly couples it with the `Notifier`. I'd argue that this is a good thing; making these two pieces of the system aware of each other creates a place to handle debouncing, coordination for time releases, and more.

```js
class DownloaderNotifier {
  constructor(options) {
    this.distPath = options.distPath;
    this.subscriptions = [];
  }

  subscribe(handler) {
    this.subscriptions.push(handler);
    return Promise.resolve();
  }

  trigger(results) {
    this.distPath = results.directory;
    this.subscriptions.forEach(handler => {
      handler(results);
    });
  }

  download() {
    return Promise.resolve(this.distPath);
  }
}
```

#### Recommendations
- Combine these two objects.
- Make the subscription API synchronous.
- Move to an event-emitter API instead of the one-off `subscribe` handler to allow for better expansion opportunities.

### Cluster Worker

Currently the cluster worker is completely unexposed. This prevents configuration of the worker in any way. Workers would ideally be able to communicate directly with logging APIs, report on their health, be launched directly, and have configuration and state information relevant to them exposed to the HTTP server that they start up.

#### Recommendations

- Extract the setup script out of the cluster master `constructor`.
- Expose a way to configure the worker object and/or the setup script.
- Extend the message handling behavior to a pattern that is not hardcoded to a limited set of states.
- Move to an event-emitter API for handling receipt and processing of information received from the cluster master or the embedded HTTP server.
- Open a bidirectional communication channel between the embedded HTTP server and the worker itself. Either of messages/events or direct exposure via a reference are possibly reasonable.
- Enable the worker to report on its state to both external processes and its parent process.

### HTTP Server Container

The HTTP server container is exposed as a public API in the project. You can pass in a reference to the HTTP server container you would like to use, already wired up with the configuration that you desire.

#### Recommendations
- Stop allowing the HTTP server container to be passed in at the top level.  Make it a cluster worker concern.
- All middleware should be loaded in a single pass, sorted via DAG. This ensures that the set of middleware in place are consistent.
