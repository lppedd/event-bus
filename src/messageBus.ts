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

export type MessageHandler<T = any> = (data: T) => void;

/**
 * Represents an active subscription to a {@link Topic}.
 *
 * Call {@link dispose} to unsubscribe from the topic.
 */
export interface Subscription {
  readonly dispose: () => void;
}

/**
 * The message bus API.
 */
export interface MessageBus {
  /**
   * Whether the message bus is disposed.
   */
  readonly isDisposed: boolean;

  /**
   * Publishes a new message without data.
   */
  publish(topic: Topic<void>): void;

  /**
   * Publishes a new message with associated data.
   */
  publish<T>(topic: Topic<T>, data: T): void;

  /**
   * Subscribes to topic.
   *
   * The returned subscription can be disposed to unsubscribe from the topic.
   */
  subscribe<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription;

  /**
   * Disposes the message bus, removing all active subscriptions.
   *
   * After disposal, no further publishing or subscribing is possible.
   */
  dispose(): void;
}

/**
 * Creates a new message bus.
 */
export function createMessageBus(options?: Partial<MessageBusOptions>): MessageBus {
  return new MessageBusImpl(options);
}
