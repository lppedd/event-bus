import type { EventHandler } from "./eventBus";
import type { Topic } from "./topic";

// @internal
export class SubscriptionRegistry {
  private readonly myMap = new Map<Topic, EventHandler[]>();

  get(topic: Topic): EventHandler[] | undefined {
    return this.myMap.get(topic);
  }

  set(topic: Topic, handler: EventHandler): void {
    let handlers = this.myMap.get(topic);

    if (!handlers) {
      this.myMap.set(topic, (handlers = []));
    }

    handlers.push(handler);
  }

  delete(topic: Topic, handler: EventHandler): void {
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
