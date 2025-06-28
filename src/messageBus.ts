import { MessageBusImpl } from "./messageBusImpl";
import type { Topic } from "./topic";

export interface MessageBusOptions {
  /**
   * If `true`, errors thrown by message handlers are caught and logged
   * to `console.error` instead of being allowed to propagate.
   *
   * @defaultValue false
   */
  readonly safePublishing: boolean;
}

/**
 * Represents an active subscription to a {@link Topic}.
 *
 * Call {@link dispose} to unsubscribe from the topic.
 */
export interface Subscription {
  readonly dispose: () => void;
}

/**
 * Represents a lazily-initialized subscription to a {@link Topic} that is also
 * an {@link AsyncIterableIterator}.
 *
 * The subscription supports consuming published messages using `for await ... of`,
 * awaiting a single message via {@link single}, and manual disposal via {@link dispose}.
 * If an async iteration completes or ends early (e.g., via `break`, `return`, or an error),
 * the subscription is automatically disposed.
 *
 * The subscription is created lazily: the first call to `next()` or `single()`
 * triggers the underlying registration. If the consumer never starts an iteration
 * or never awaits a message, no subscription is created.
 */
export interface LazyAsyncSubscription<T> extends AsyncIterableIterator<T>, Subscription {
  readonly single: () => Promise<T>;
}

export type MessageHandler<T = any> = (data: T) => void;

/**
 * The message bus API.
 */
export interface MessageBus {
  /**
   * Whether the message bus is disposed.
   */
  readonly isDisposed: boolean;

  /**
   * Creates a new child bus linked to this one for hierarchical broadcasting.
   *
   * Messages with `children` broadcast direction will be propagated to it.
   */
  createChildBus(options?: Partial<MessageBusOptions>): MessageBus;

  /**
   * Publishes a new message without data.
   */
  publish(topic: Topic<void>): void;

  /**
   * Publishes a new message with associated data.
   */
  publish<T>(topic: Topic<T>, data: T): void;

  /**
   * Creates a lazily-initialized subscription to the specified topic that is also
   * an {@link AsyncIterableIterator}.
   *
   * This allows consuming published messages using the `for await ... of` syntax.
   * If an async iteration completes or ends early (e.g., via `break`, `return`, or an error),
   * the subscription is automatically disposed.
   *
   * The subscription is created lazily: the first call to `next()` or `single()`
   * triggers the underlying registration. If the consumer never starts an iteration
   * or never awaits a message, no subscription is created.
   *
   * @example
   * ```ts
   * const subscription = messageBus.subscribe(CommandTopic);
   *
   * for await (const command of subscription) {
   *   switch (command) {
   *     case "shutdown":
   *       // ...
   *       break;
   *     case "restart":
   *       // ...
   *       break;
   *   }
   * }
   * ```
   */
  subscribe<T>(topic: Topic<T>): LazyAsyncSubscription<T>;

  /**
   * Subscribes to the specified topic.
   *
   * The returned subscription can be disposed to unsubscribe from the topic.
   */
  subscribe<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription;

  /**
   * Disposes the message bus and all its child buses, removing all active subscriptions.
   *
   * After disposal, neither this bus nor any child buses can be used for publishing or subscribing.
   */
  dispose(): void;
}

/**
 * Creates a new message bus.
 */
export function createMessageBus(options?: Partial<MessageBusOptions>): MessageBus {
  return new MessageBusImpl(undefined, options);
}
