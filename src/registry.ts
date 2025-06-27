import type { MessageHandler } from "./messageBus";
import type { Topic } from "./topic";

// @internal
export class SubscriptionRegistry {
  private readonly myMap = new Map<Topic, MessageHandler[]>();

  get(topic: Topic): MessageHandler[] | undefined {
    return this.myMap.get(topic);
  }

  set(topic: Topic, handler: MessageHandler): void {
    let handlers = this.myMap.get(topic);

    if (!handlers) {
      this.myMap.set(topic, (handlers = []));
    }

    handlers.push(handler);
  }

  delete(topic: Topic, handler: MessageHandler): void {
    const handlers = this.myMap.get(topic);

    if (handlers) {
      const index = handlers.indexOf(handler);

      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  clear(): void {
    this.myMap.clear();
  }
}
