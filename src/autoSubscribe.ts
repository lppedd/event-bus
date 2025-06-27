import type { Constructor } from "./contructor";
import type { EventBus } from "./eventBus";
import { getMetadata } from "./metadata";

// TypeScript's built-in type uses Function as upper type, which is too generic
// @internal
type ClassDecorator = <T extends Constructor<object>>(target: T) => T | void;

/**
 * Class decorator that automatically subscribes to event topics based on method parameter decorators.
 *
 * This decorator inspects the decorated class looking for methods with topic-decorated parameters,
 * and subscribes to those topics using the provided {@link eventBus}.
 *
 * When an event is published, the decorated parameter's method is called with the event data.
 * If the class instance is garbage collected, the subscription is automatically disposed.
 *
 * @param eventBus The event bus instance to use for creating subscriptions.
 *
 * @example
 * ```ts
 * const eventBus = createEventBus();
 *
 * @AutoSubscribe(eventBus)
 * class UserManager {
 *   onUserLogin(@LoginTopic login: UserLogin): void {
 *     // ...
 *   }
 * }
 * ```
 */
export function AutoSubscribe(eventBus: EventBus): ClassDecorator {
  return function (Class) {
    return class extends Class {
      constructor(...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super(...args);

        const thisRef = new WeakRef(this);
        const metadata = getMetadata(Class);

        for (const [methodKey, methodSub] of metadata.subscriptions.methods) {
          const subscription = eventBus.subscribe(methodSub.topic, (data) => {
            const deref = thisRef.deref();

            if (deref) {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
              (deref as any)[methodKey](data);
            } else {
              // The instance has been GCed, so we can get rid of the subscription
              subscription.dispose();
            }
          });
        }
      }
    };
  };
}
