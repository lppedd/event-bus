import { EventBusImpl } from "./eventBusImpl";
import type { Topic } from "./topic";

export interface EventBusOptions {
  /**
   * @defaultValue false
   */
  readonly safePublishing: boolean;
}

export type EventHandler<T = any> = (data: T) => void;

export interface Subscription {
  readonly dispose: () => void;
}

export interface EventBus {
  publish<T>(topic: Topic<T>, data: T): void;
  subscribe<T>(topic: Topic<T>, handler: EventHandler<T>): Subscription;
  dispose(): void;
}

export function createEventBus(options?: Partial<EventBusOptions>): EventBus {
  return new EventBusImpl(options);
}
