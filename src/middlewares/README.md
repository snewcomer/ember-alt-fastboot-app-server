# Bundled Middlewares

These middlewares are bundled by default into `ember-alt-fastboot-app-server`. They have a topological sort that you can insert your own middleware into by specifying `before` and `after`. This allows you to change the server behavior *without* having access to any of these middlewares.

They're designed to export a factory function that returns a fully wired, possibly-stateful instance of the middleware. The state must be managed between the worker and the middleware itself.
