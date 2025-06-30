import type { Constructor } from "./contructor";
import type { MessageBus } from "./messageBus";
import { getMetadata } from "./metadata";

// TypeScript's built-in type uses Function as upper type, which is too generic
// @internal
type ClassDecorator = <T extends Constructor<object>>(target: T) => T | void;

/**
 * Class decorator that automatically subscribes to topics based on method parameter decorators.
 *
 * This decorator inspects the decorated class looking for methods with topic-decorated parameters,
 * and subscribes to those topics using the provided `messageBus`.
 *
 * When a message is published, the decorated parameter's method is invoked with the message data.
 * If the class instance is garbage collected, the topic subscription is automatically disposed.
 *
 * @example
 * ```ts
 * const messageBus = createMessageBus();
 *
 * @AutoSubscribe(messageBus)
 * class UserManager {
 *   onUserLogin(@LoginTopic login: UserLogin): void {
 *     // ...
 *   }
 * }
 * ```
 *
 * @param messageBus The message bus instance to use for creating subscriptions.
 */
export function AutoSubscribe(messageBus: MessageBus | (() => MessageBus)): ClassDecorator {
  return function (Class) {
    return class extends Class {
      constructor(...args: any[]) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        super(...args);

        const metadata = getMetadata(Class);
        const bus = typeof messageBus === "function" ? messageBus() : messageBus;
        const thisRef = new WeakRef(this);

        for (const [methodKey, methodSub] of metadata.subscriptions.methods) {
          const subscription = bus.withPriority(methodSub.priority).subscribe(methodSub.topic, (data) => {
            const deref = thisRef.deref();

            if (deref) {
              const args = new Array(methodSub.index + 2);
              args[methodSub.index] = data;
              args[methodSub.index + 1] = subscription;

              // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
              (deref as any)[methodKey](...args);
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
