import { error } from "./errors";
import type { MessageBus, MessageBusOptions, MessageHandler, Subscription } from "./messageBus";
import { SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class MessageBusImpl implements MessageBus {
  private readonly myRegistry = new SubscriptionRegistry();
  private readonly myOptions: MessageBusOptions;
  private readonly myPublishQueue: (() => void)[] = [];

  private myPublishing: boolean = false;
  private myDisposed: boolean = false;

  constructor(options?: Partial<MessageBusOptions>) {
    this.myOptions = {
      safePublishing: false,
      ...options,
    };
  }

  get isDisposed(): boolean {
    return this.myDisposed;
  }

  publish<T>(topic: Topic<T>, data?: T): void {
    this.checkDisposed();
    const handlers = this.myRegistry.get(topic);

    if (handlers) {
      this.myPublishQueue.push(() => this.publishMessage(handlers, data));

      if (!this.myPublishing) {
        this.myPublishing = true;
        queueMicrotask(() => this.drainPublishQueue());
      }
    }
  }

  subscribe<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription {
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

  private publishMessage<T>(handlers: MessageHandler[], data: T): void {
    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i]!;

      try {
        handler(data);
      } catch (e) {
        if (!this.myOptions.safePublishing) {
          error("a message handler did not complete correctly", e);
        }

        console.error(e);
      }
    }
  }

  private drainPublishQueue(): void {
    while (this.myPublishQueue.length > 0) {
      const next = this.myPublishQueue.shift()!;
      next();
    }

    this.myPublishing = false;
  }

  private checkDisposed(): void {
    if (this.myDisposed) {
      error("the message bus is disposed");
    }
  }
}
