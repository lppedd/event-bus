import type { MessageHandler, Subscription } from "./messageBus";
import type { Topic } from "./topic";

// @internal
export const defaultPriority: number = 1;

// @internal
export interface Registration extends Subscription {
  isDisposed: boolean;
  remaining: number;
  priority: number;
  handler: MessageHandler;
}

// @internal
export class SubscriptionRegistry {
  private readonly myMap = new Map<Topic, Registration[]>();

  get(topic: Topic): Registration[] | undefined {
    return this.myMap.get(topic);
  }

  set(topic: Topic, registration: Registration): void {
    let registrations = this.myMap.get(topic);

    if (!registrations) {
      this.myMap.set(topic, (registrations = []));
    }

    registrations.push(registration);
  }

  delete(topic: Topic, registration: Registration): void {
    const registrations = this.myMap.get(topic);

    if (registrations) {
      const index = registrations.indexOf(registration);

      if (index > -1) {
        registrations.splice(index, 1);
      }
    }
  }

  values(): Registration[] {
    return Array.from(this.myMap.values()).flat();
  }

  clear(): void {
    this.myMap.clear();
  }
}
