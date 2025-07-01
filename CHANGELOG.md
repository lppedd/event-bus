# Changelog

## 0.1.3

- Exposed the dummy `__type?: T` property on the `Topic<T>` interface to fix
  type compatibility issues in `MessageBus.publish` overloads.

## 0.1.2

- Refined the `@AutoSubscribe` decorator enhancement introduced in 0.1.1.

## 0.1.1

- Improved `@AutoSubscribe` interoperability with other decorator-based libraries.  
  The decorator now optionally returns the transformed class to support external
  consumption (e.g., for DI container registration).

## 0.1.0

Initial release, with most documented features already implemented.
