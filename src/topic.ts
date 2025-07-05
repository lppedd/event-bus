/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { Constructor } from "./contructor";
import { error } from "./errors";
import { getMetadata } from "./metadata";
import { defaultPriority } from "./registry";

/**
 * The broadcasting direction for a topic.
 *
 * A message published to the topic will always be delivered first to handlers
 * registered on the bus where `publish()` is called.
 *
 * Then, if the direction is:
 * - `children`: the message is also propagated to all child buses recursively
 * - `parent`: the message is also propagated to the **immediate** parent bus
 */
export type BroadcastDirection = "children" | "parent";

/**
 * An identifier used to categorize messages in the message bus.
 */
export interface Topic<T = unknown> {
  // Decorator's callable signature
  (priority?: number): ParameterDecorator;

  /**
   * A human-readable name for the topic, useful for debugging and logging.
   */
  readonly displayName: string;

  /**
   * The broadcasting direction for the topic.
   *
   * @see {@link BroadcastDirection}
   */
  readonly broadcastDirection: BroadcastDirection;

  /**
   * Ensures that different Topic<T> types are not structurally compatible.
   * This property is never used at runtime.
   *
   * @private
   */
  readonly __type?: T;
}

/**
 * Creates a new {@link Topic} that can be used to publish or subscribe to messages.
 *
 * @example
 * ```ts
 * const EnvTopic = createTopic<string>("Env");
 * messageBus.subscribe(EnvTopic, (data) => console.log(data));
 * messageBus.publish(EnvTopic, "production"); // => 'production' logged to the console
 * ```
 *
 * @param displayName A human-readable name for the topic, useful for debugging and logging.
 * @param broadcastDirection The broadcasting direction for the topic. `children` by default.
 */
export function createTopic<T>(
  displayName: string,
  broadcastDirection: BroadcastDirection = "children",
): Topic<T> {
  const topicDebugName = `Topic<${displayName}>`;
  const topic = (priority: number = defaultPriority): ParameterDecorator => {
    return function (target: any, propertyKey: string | symbol | undefined, parameterIndex: number): void {
      // Error out if the topic decorator has been applied to a static method
      if (propertyKey !== undefined && typeof target === "function") {
        const member = `${target.name}.${String(propertyKey)}`;
        error(`decorator for ${topicDebugName} cannot be used on static member ${member}`);
      }

      if (propertyKey === undefined) {
        error(`decorator for ${topicDebugName} cannot be used on ${target.name}'s constructor`);
      }

      const metadata = getMetadata(target.constructor as Constructor<object>);
      const methods = metadata.subscriptions.methods;
      const methodSub = methods.get(propertyKey);

      if (methodSub) {
        const member = `${target.constructor.name}.${String(propertyKey)}`;
        error(`only a single topic subscription is allowed on ${member}`);
      }

      methods.set(propertyKey, {
        topic: topic as unknown as Topic<T>,
        index: parameterIndex,
        priority: priority,
      });
    };
  };

  (topic as any).displayName = topicDebugName;
  (topic as any).broadcastDirection = broadcastDirection;
  (topic as any).toString = () => topicDebugName;
  return topic as unknown as Topic<T>;
}
