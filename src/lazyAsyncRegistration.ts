import { error } from "./errors";
import type { LazyAsyncSubscription } from "./messageBus";
import type { Registration, SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class LazyAsyncRegistration<T> implements Registration, LazyAsyncSubscription<T> {
  private readonly myDataQueue: T[] = [];
  private readonly myPromiseQueue: [(v: IteratorResult<T>) => void, (e?: any) => void][] = [];
  private readonly myRegistry: SubscriptionRegistry;
  private readonly myTopic: Topic<T>;
  private isRegistered: boolean = false;

  isDisposed: boolean = false;
  remaining: number;
  priority: number;

  constructor(registry: SubscriptionRegistry, topic: Topic<T>, limit: number, priority: number) {
    this.myRegistry = registry;
    this.myTopic = topic;
    this.remaining = limit;
    this.priority = priority;
  }

  handler = (data: T): void => {
    if (this.remaining === 0) {
      this.dispose();
      return;
    }

    if (this.remaining > 0) {
      this.remaining--;
    }

    if (this.myPromiseQueue.length > 0) {
      const [resolve] = this.myPromiseQueue.shift()!;
      resolve({ done: false, value: data });
    } else {
      this.myDataQueue.push(data);
    }
  };

  dispose = (): void => {
    this.isDisposed = true;
    this.myRegistry.delete(this.myTopic, this);
  };

  single = async (): Promise<T> => {
    const { done, value } = await this.next();
    return !done ? value : error("the subscription is disposed");
  };

  next = async (): Promise<IteratorResult<T>> => {
    // Consume from the queue before waiting for more data
    if (this.myDataQueue.length > 0) {
      const data = this.myDataQueue.shift()!;
      return { done: false, value: data };
    }

    if (this.isDisposed) {
      return { done: true, value: undefined };
    }

    if (!this.isRegistered) {
      this.isRegistered = true;
      this.myRegistry.set(this.myTopic, this);
    }

    return new Promise((resolve, reject) => this.myPromiseQueue.push([resolve, reject]));
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  return = async (): Promise<IteratorResult<T>> => {
    this.dispose();

    // Resolve pending promises
    while (this.myPromiseQueue.length > 0) {
      const [resolve] = this.myPromiseQueue.shift()!;
      resolve({ done: true, value: undefined });
    }

    return { done: true, value: undefined };
  };

  throw = (e?: any): Promise<IteratorResult<T>> => {
    this.dispose();

    while (this.myPromiseQueue.length > 0) {
      const [, reject] = this.myPromiseQueue.shift()!;
      reject(e);
    }

    throw e;
  };

  public [Symbol.asyncIterator] = (): AsyncIterableIterator<T> => this;
}
