import type { MessageHandler } from "./messageBus";
import type { Registration, SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class HandlerRegistration<T> implements Registration {
  __isDisposed: boolean = false;
  __remaining: number = -1;

  constructor(
    private readonly myRegistry: SubscriptionRegistry,
    private readonly myTopic: Topic<T>,
    private readonly myHandler: MessageHandler<T>,
  ) {}

  __handler = (data: T): void => {
    if (this.__remaining === 0) {
      this.dispose();
      return;
    }

    if (this.__remaining > 0) {
      this.__remaining--;
    }

    this.myHandler(data);
  };

  dispose = (): void => {
    this.__isDisposed = true;
    this.myRegistry.delete(this.myTopic, this);
  };
}
