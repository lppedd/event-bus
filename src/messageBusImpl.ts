import { error } from "./errors";
import type { MessageBus, MessageBusOptions, MessageHandler, Subscription } from "./messageBus";
import { SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class MessageBusImpl implements MessageBus {
  private readonly myOptions: MessageBusOptions;
  private readonly myRegistry = new SubscriptionRegistry();
  private readonly myChildren = new Set<MessageBusImpl>();
  private readonly myPublishQueue: (() => void)[] = [];

  private myPublishing: boolean = false;
  private myDisposed: boolean = false;

  constructor(
    private readonly myParent: MessageBusImpl | undefined,
    options?: Partial<MessageBusOptions>,
  ) {
    this.myOptions = {
      safePublishing: false,
      ...options,
    };
  }

  get isDisposed(): boolean {
    return this.myDisposed;
  }

  createChildBus(options?: Partial<MessageBusOptions>): MessageBus {
    const child = new MessageBusImpl(this, {
      ...this.myOptions,
      ...options,
    });

    this.myChildren.add(child);
    return child;
  }

  publish<T>(topic: Topic<T>, data?: T, /* @internal */ stopHere?: boolean): void {
    this.checkDisposed();
    this.myPublishQueue.push(() => this.publishMessage(topic, data, stopHere));

    if (!this.myPublishing) {
      this.myPublishing = true;
      queueMicrotask(() => this.drainPublishQueue());
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
    if (this.myDisposed) {
      return;
    }

    this.myDisposed = true;

    // Remove this bus from the parent's child buses
    this.myParent?.myChildren?.delete(this);

    // Dispose child buses
    for (const child of this.myChildren) {
      child.dispose();
    }

    this.myChildren.clear();
    this.myRegistry.clear();
  }

  private publishMessage<T>(topic: Topic<T>, data: T | undefined, stopHere?: boolean): void {
    // Keep in mind that publish() will queue the task, so child buses,
    // or the parent bus depending on the broadcasting direction,
    // will receive the message after this bus
    if (!stopHere) {
      switch (topic.broadcastDirection) {
        case "children":
          for (const child of this.myChildren) {
            child.publish(topic, data);
          }

          break;
        case "parent":
          this.myParent?.publish(topic, data, true);
          break;
      }
    }

    this.publishMessageToHandlers(topic, data);
  }

  private publishMessageToHandlers<T>(topic: Topic<T>, data: T): void {
    const handlers = this.myRegistry.get(topic);

    if (!handlers) {
      return;
    }

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
