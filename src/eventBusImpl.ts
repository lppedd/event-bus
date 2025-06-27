import { error } from "./errors";
import type { EventBus, EventBusOptions, EventHandler, Subscription } from "./eventBus";
import { SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class EventBusImpl implements EventBus {
  private readonly myRegistry = new SubscriptionRegistry();
  private readonly myOptions: EventBusOptions;
  private myDisposed: boolean = false;

  constructor(options?: Partial<EventBusOptions>) {
    this.myOptions = {
      safePublishing: false,
      ...options,
    };
  }

  publish<T>(topic: Topic<T>, data?: T): void {
    this.checkDisposed();
    const handlers = this.myRegistry.get(topic);

    if (handlers) {
      this.publishEvent(handlers, data);
    }
  }

  subscribe<T>(topic: Topic<T>, handler: EventHandler<T>): Subscription {
    this.checkDisposed();
    this.myRegistry.set(topic, handler);
    const handlerRef = new WeakRef(handler);
    return {
      dispose: () => {
        const deref = handlerRef.deref();

        if (deref) {
          this.myRegistry.delete(topic, deref);
        }
      },
    };
  }

  dispose(): void {
    this.myDisposed = true;
    this.myRegistry.clear();
  }

  private publishEvent<T>(handlers: EventHandler[], data: T): void {
    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i]!;

      try {
        handler(data);
      } catch (e) {
        if (!this.myOptions.safePublishing) {
          error("an event handler did not complete correctly", e);
        }

        console.error(e);
      }
    }
  }

  private checkDisposed(): void {
    if (this.myDisposed) {
      error("the event bus is disposed");
    }
  }
}
