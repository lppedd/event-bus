import { MessageBusImpl } from "./messageBusImpl";
import type { Topic } from "./topic";

export interface MessageBusOptions {
  /**
   * If `true`, errors thrown by message handlers are caught and sent
   * to the `errorHandler` instead of being allowed to propagate.
   *
   * The default `errorHandler` prints to `console.error`.
   *
   * @defaultValue false
   */
  readonly safePublishing: boolean;

  /**
   * A handler for caught unhandled errors from message handlers,
   * called when `safePublishing` is true.
   *
   * @defaultValue (e) => console.error(e)
   */
  readonly errorHandler: (e: unknown) => void;
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
   * Publishes a new message without any associated data to the specified topic.
   *
   * @example
   * ```ts
   * messageBus.publish(PingTopic);
   * ```
   *
   * @param topic The topic to publish the message to.
   */
  publish(topic: Topic<void>): void;

  /**
   * Publishes a new message with associated data to the specified topic.
   *
   * @example
   * ```ts
   * messageBus.publish(CommandTopic, "shutdown");
   * ```
   *
   * @param topic The topic to publish the message to.
   * @param data The data payload to send with the message.
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
   *
   * @param topic The topic to subscribe to.
   * @param limit An optional max number of topic messages to receive.
   */
  subscribe<T>(topic: Topic<T>, limit?: number): LazyAsyncSubscription<T>;

  /**
   * Subscribes to the specified topic with a callback.
   *
   * The subscription is established immediately, and you can call
   * {@link Subscription.dispose} to unsubscribe.
   *
   * @example
   * ```ts
   * const subscription = messageBus.subscribe(CommandTopic, (command) => {
   *   switch (command) {
   *     case "shutdown":
   *       // ...
   *       break;
   *     case "restart":
   *       // ...
   *       break;
   *   }
   * });
   *
   * // Later
   * subscription.dispose();
   * ```
   *
   * @param topic The topic to subscribe to.
   * @param handler A callback invoked on each topic message.
   */
  subscribe<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription;

  /**
   * Subscribes to the specified topic with a callback and a message limit.
   *
   * The subscription will be automatically disposed from after receiving `limit` messages.
   *
   * @example
   * ```ts
   * // Automatically unsubscribes after 3 messages
   * messageBus.subscribe(CommandTopic, 3, (command) => {
   *   switch (command) {
   *     case "shutdown":
   *       // ...
   *       break;
   *     case "restart":
   *       // ...
   *       break;
   *   }
   * });
   * ```
   *
   * @param topic The topic to subscribe to.
   * @param limit The max number of topic messages to receive.
   * @param handler A callback invoked on each topic message.
   */
  subscribe<T>(topic: Topic<T>, limit: number, handler: MessageHandler<T>): Subscription;

  /**
   * Subscribes once to the specified topic, returning a promise that resolves
   * with the next published message.
   *
   * The subscription will be automatically disposed after receiving the message.
   * This allows awaiting a single message without manual subscription management.
   *
   * @example
   * ```ts
   * const command = await messageBus.subscribeOnce(CommandTopic);
   * console.log(`Received command: ${command}`);
   * ```
   *
   * @param topic The topic to subscribe to.
   */
  subscribeOnce<T>(topic: Topic<T>): Promise<T>;

  /**
   * Subscribes once to the specified topic with a callback.
   *
   * The callback will be invoked exactly once with the next published message,
   * after which the subscription is automatically disposed.
   *
   * @example
   * ```ts
   * // Automatically unsubscribes after the message
   * messageBus.subscribeOnce(CommandTopic, (command) => {
   *   console.log(`Received command: ${command}`);
   * });
   * ```
   *
   * @param topic The topic to subscribe to.
   * @param handler A callback invoked on the next topic message.
   */
  subscribeOnce<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription;

  /**
   * Disposes the message bus, all its child buses, and all active subscriptions.
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
