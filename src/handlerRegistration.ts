import type { MessageHandler } from "./messageBus";
import type { Registration, SubscriptionRegistry } from "./registry";
import type { Topic } from "./topic";

// @internal
export class HandlerRegistration implements Registration {
  private readonly myRegistry: SubscriptionRegistry;
  private readonly myTopic: Topic;
  private readonly myHandler: MessageHandler;

  isDisposed: boolean = false;
  remaining: number;
  priority: number;

  constructor(
    registry: SubscriptionRegistry,
    topic: Topic,
    handler: MessageHandler,
    limit: number,
    priority: number,
  ) {
    this.myRegistry = registry;
    this.myTopic = topic;
    this.myHandler = handler;
    this.remaining = limit;
    this.priority = priority;
  }

  handler = (data: unknown): void => {
    if (this.remaining === 0) {
      this.dispose();
      return;
    }

    if (this.remaining > 0) {
      this.remaining--;
    }

    this.myHandler(data);
  };

  dispose = (): void => {
    this.isDisposed = true;
    this.myRegistry.delete(this.myTopic, this);
  };
}
