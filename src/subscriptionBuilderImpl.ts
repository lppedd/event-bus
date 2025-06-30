import { assert } from "./errors";
import { LazyAsyncRegistration } from "./lazyAsyncRegistration";
import type { LazyAsyncSubscription, MessageHandler, Subscription, SubscriptionBuilder } from "./messageBus";
import type { MessageBusImpl } from "./messageBusImpl";
import { defaultPriority } from "./registry";
import type { Topic } from "./topic";

// @internal
export class SubscriptionBuilderImpl implements SubscriptionBuilder {
  private readonly myMessageBus: MessageBusImpl;
  private myLimit: number;
  private myPriority: number;

  constructor(messageBus: MessageBusImpl, limit: number, priority: number) {
    this.myMessageBus = messageBus;
    this.myLimit = limit;
    this.myPriority = priority;
  }

  withLimit(limit: number): SubscriptionBuilder {
    assert(limit > 0, "the limit value must be greater than 0");
    this.myLimit = limit;
    return this;
  }

  withPriority(priority: number): SubscriptionBuilder {
    this.myPriority = priority;
    return this;
  }

  subscribe<T>(topic: Topic<T>): LazyAsyncSubscription<T>;
  subscribe<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription;
  subscribe<T>(topic: Topic<T>, handler?: MessageHandler<T>): Subscription | LazyAsyncSubscription<T> {
    return this.myMessageBus.subscribeImpl(topic, handler, this.myLimit, this.myPriority);
  }

  subscribeOnce<T>(topic: Topic<T>): Promise<T>;
  subscribeOnce<T>(topic: Topic<T>, handler: MessageHandler<T>): Subscription;
  subscribeOnce<T>(topic: Topic<T>, handler?: MessageHandler<T>): Subscription | Promise<T> {
    assert(this.myLimit === 1, "setting a limit is not supported with subscribeOnce");
    const subscription = this.myMessageBus.subscribeImpl(topic, handler, 1, defaultPriority);
    return subscription instanceof LazyAsyncRegistration
      ? subscription.single().finally(() => subscription.dispose())
      : subscription;
  }
}
