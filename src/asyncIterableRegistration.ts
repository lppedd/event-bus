import { error, tag } from "./errors";
import type { LazyAsyncSubscription } from "./messageBus";
import type { Registration, SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class AsyncIterableRegistration<T> implements Registration, LazyAsyncSubscription<T> {
  private readonly dataQueue: T[] = [];
  private readonly promiseQueue: [(v: IteratorResult<T>) => void, (e?: any) => void][] = [];

  __isRegistered: boolean = false;
  __isDisposed: boolean = false;
  __remaining: number = -1;

  constructor(
    private readonly myRegistry: SubscriptionRegistry,
    private readonly myTopic: Topic<T>,
  ) {}

  __handler = (data: T): void => {
    if (this.__remaining === 0) {
      this.dispose();
      return;
    }

    if (this.__remaining > 0) {
      this.__remaining--;
    }

    if (this.promiseQueue.length > 0) {
      const [res] = this.promiseQueue.shift()!;
      res({ done: false, value: data });
    } else {
      this.dataQueue.push(data);
    }
  };

  dispose = (): void => {
    this.__isDisposed = true;
    this.myRegistry.delete(this.myTopic, this);

    // Reject pending promises with an error
    while (this.promiseQueue.length > 0) {
      const [, rej] = this.promiseQueue.shift()!;
      rej(Error(tag("the subscription is disposed")));
    }
  };

  single = async (): Promise<T> => {
    const { done, value } = await this.next();
    return !done ? value : error("the subscription is disposed");
  };

  next = async (): Promise<IteratorResult<T>> => {
    if (this.__isDisposed) {
      error("the subscription is disposed");
    }

    if (!this.__isRegistered) {
      this.__isRegistered = true;
      this.myRegistry.set(this.myTopic, this);
    }

    // Consume from the queue before waiting for more data
    if (this.dataQueue.length > 0) {
      const data = this.dataQueue.shift()!;
      return { done: false, value: data };
    }

    return new Promise((res, rej) => this.promiseQueue.push([res, rej]));
  };

  // eslint-disable-next-line @typescript-eslint/require-await
  return = async (): Promise<IteratorResult<T>> => {
    this.dispose();

    // Resolve pending promises
    while (this.promiseQueue.length > 0) {
      const [res] = this.promiseQueue.shift()!;
      res({ done: true, value: undefined });
    }

    return { done: true, value: undefined };
  };

  throw = (e?: any): Promise<IteratorResult<T>> => {
    this.dispose();

    while (this.promiseQueue.length > 0) {
      const [, rej] = this.promiseQueue.shift()!;
      rej(e);
    }

    throw e;
  };

  public [Symbol.asyncIterator] = (): AsyncIterableIterator<T> => this;
}
