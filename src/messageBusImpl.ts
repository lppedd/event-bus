import { assert, error, tag } from "./errors";
import { HandlerRegistration } from "./handlerRegistration";
import { LazyAsyncRegistration } from "./lazyAsyncRegistration";
import type {
  ChildMessageBusOptions,
  LazyAsyncSubscription,
  MessageBus,
  MessageBusOptions,
  MessageHandler,
  MessageListener,
  Subscription,
  SubscriptionBuilder,
} from "./messageBus";
import { defaultLimit, defaultPriority, SubscriptionRegistry } from "./registry";
import { SubscriptionBuilderImpl } from "./subscriptionBuilderImpl";
import type { Topic } from "./topic";

// @internal
export class MessageBusImpl implements MessageBus {
  private readonly myParent?: MessageBusImpl;
  private readonly myOptions: MessageBusOptions;
  private readonly myListeners: Set<MessageListener>;
  private readonly myRegistry = new SubscriptionRegistry();
  private readonly myChildren = new Set<MessageBusImpl>();
  private readonly myPublishQueue: (() => void)[] = [];

  private myPublishing: boolean = false;
  private myDisposed: boolean = false;

  constructor(
    parent?: MessageBusImpl,
    listeners?: Set<MessageListener>,
    options?: Partial<MessageBusOptions>,
  ) {
    this.myParent = parent;
    this.myListeners = listeners ?? new Set();
    this.myOptions = {
      safePublishing: false,
      errorHandler: (e) => {
        console.error(tag("caught unhandled error in message handler (safePublishing: true)."), e);
      },
      ...options,
    };
  }

  get isDisposed(): boolean {
    return this.myDisposed;
  }

  createChildBus(options?: Partial<ChildMessageBusOptions>): MessageBus {
    this.checkDisposed();

    const listeners = options?.copyListeners === false ? undefined : new Set(this.myListeners);
    const childBus = new MessageBusImpl(this, listeners, {
      ...this.myOptions,
      ...options,
    });

    this.myChildren.add(childBus);
    return childBus;
  }

  publish(topic: Topic, data?: unknown): void {
    this.publishImpl(topic, data, true, true);
  }

  subscribe(topic: Topic): LazyAsyncSubscription;
  subscribe(topic: Topic, handler: MessageHandler): Subscription;
  subscribe(topic: Topic, handler?: MessageHandler): Subscription | LazyAsyncSubscription {
    return this.subscribeImpl(topic, handler, defaultLimit, defaultPriority);
  }

  subscribeOnce(topic: Topic): Promise<unknown>;
  subscribeOnce(topic: Topic, handler: MessageHandler): Subscription;
  subscribeOnce(topic: Topic, handler?: MessageHandler): Subscription | Promise<unknown> {
    const subscription = this.subscribeImpl(topic, handler, 1, defaultPriority);
    return subscription instanceof LazyAsyncRegistration
      ? subscription.single().finally(() => subscription.dispose())
      : subscription;
  }

  // @internal
  subscribeImpl(
    topic: Topic,
    handler: MessageHandler | undefined,
    limit: number,
    priority: number,
  ): LazyAsyncRegistration | Subscription {
    this.checkDisposed();

    if (handler) {
      const registration = new HandlerRegistration(this.myRegistry, topic, handler, limit, priority);
      this.myRegistry.set(topic, registration);
      return registration;
    }

    return new LazyAsyncRegistration(this.myRegistry, topic, limit, priority);
  }

  withLimit(limit: number): SubscriptionBuilder {
    this.checkDisposed();
    assert(limit > 0, "the limit value must be greater than 0");
    return new SubscriptionBuilderImpl(this, limit, defaultPriority);
  }

  withPriority(priority: number): SubscriptionBuilder {
    this.checkDisposed();
    return new SubscriptionBuilderImpl(this, defaultLimit, priority);
  }

  addListener(listener: MessageListener): void {
    this.checkDisposed();
    this.myListeners.add(listener);
  }

  removeListener(listener: MessageListener): void {
    this.checkDisposed();
    this.myListeners.delete(listener);
  }

  dispose(): void {
    if (this.myDisposed) {
      return;
    }

    this.myDisposed = true;

    // Remove this bus from the parent's child buses
    this.myParent?.myChildren?.delete(this);

    // Dispose all registrations (a.k.a. subscriptions) created by this bus
    for (const registration of this.myRegistry.values()) {
      registration.dispose();
    }

    // Dispose child buses
    for (const child of this.myChildren) {
      child.dispose();
    }

    this.myChildren.clear();
    this.myRegistry.clear();
    this.myListeners.clear();
  }

  private publishImpl(topic: Topic, data: unknown, broadcast: boolean, listeners: boolean): void {
    this.checkDisposed();
    this.myPublishQueue.push(() => this.publishMessage(topic, data, broadcast, listeners));

    if (!this.myPublishing) {
      this.myPublishing = true;
      queueMicrotask(() => this.drainPublishQueue());
    }
  }

  private publishMessage(topic: Topic, data: unknown, broadcast: boolean, listeners: boolean): void {
    // Keep in mind that publish() will queue the task, so child buses,
    // or the parent bus depending on the broadcasting direction,
    // will receive the message after this bus
    if (broadcast) {
      switch (topic.broadcastDirection) {
        case "children":
          for (const child of this.myChildren) {
            child.publishImpl(topic, data, true, false);
          }

          break;
        case "parent":
          this.myParent?.publishImpl(topic, data, false, false);
          break;
      }
    }

    const registrations = this.myRegistry.get(topic);
    const registrationCount = registrations?.length ?? 0;

    if (listeners) {
      // Listeners are invoked in the order they have been added
      for (const listener of this.myListeners) {
        listener(topic, data, registrationCount);
      }
    }

    if (registrations && registrationCount > 0) {
      // Sort registrations by priority. A lower priority value means being invoked first.
      registrations.sort((a, b) => a.priority - b.priority);

      for (const registration of registrations) {
        try {
          registration.handler(data);
        } catch (e) {
          if (!this.myOptions.safePublishing) {
            error("unhandled error in message handler", e);
          }

          this.myOptions.errorHandler(e);
        }
      }
    }
  }

  private drainPublishQueue(): void {
    if (!this.myDisposed) {
      while (this.myPublishQueue.length > 0) {
        const next = this.myPublishQueue.shift()!;
        next();
      }
    }

    this.myPublishing = false;
  }

  private checkDisposed(): void {
    if (this.myDisposed) {
      error("the message bus is disposed");
    }
  }
}
