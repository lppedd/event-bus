import { EventBusImpl } from "./eventBusImpl";
import type { Topic } from "./topic";

export interface EventBusOptions {
  /**
   * If `true`, errors thrown by event handlers are caught and logged
   * to `console.error` instead of being allowed to propagate.
   *
   * @defaultValue false
   */
  readonly safePublishing: boolean;
}

export type EventHandler<T = any> = (data: T) => void;

/**
 * Represents an active subscription to a {@link Topic}.
 *
 * Call {@link dispose} to unsubscribe from the topic.
 */
export interface Subscription {
  readonly dispose: () => void;
}

/**
 * The event bus API.
 */
export interface EventBus {
  /**
   * Publishes a new event without data for the given topic.
   */
  publish(topic: Topic<void>): void;

  /**
   * Publishes a new event with associated data for the given topic.
   */
  publish<T>(topic: Topic<T>, data: T): void;

  /**
   * Subscribes to topic.
   *
   * The returned subscription can be disposed to unsubscribe from the topic.
   */
  subscribe<T>(topic: Topic<T>, handler: EventHandler<T>): Subscription;

  /**
   * Disposes the event bus, removing all active subscriptions.
   *
   * After disposal, no further publishing or subscribing is possible.
   */
  dispose(): void;
}

/**
 * Creates a new event bus.
 */
export function createEventBus(options?: Partial<EventBusOptions>): EventBus {
  return new EventBusImpl(options);
}
