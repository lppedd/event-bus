/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import type { Constructor } from "./contructor";
import { error } from "./errors";
import { getMetadata } from "./metadata";

/**
 * An identifier used to categorize events in the event bus.
 */
export interface Topic<T = any> {
  /**
   * A human-readable name for the topic, useful for debugging and logging.
   */
  readonly topicName: string;

  /**
   * @internal
   */
  (...args: any[]): void;

  /**
   * @internal
   */
  readonly type: T;
}

/**
 * Creates a new {@link Topic} that can be used to publish or subscribe to events.
 *
 * @example
 * ```ts
 * const EnvTopic = createTopic<string>("Env");
 * eventBus.subscribe(EnvTopic, (data) => console.log(data));
 * eventBus.publish(EnvTopic, "production"); // => 'production' logged to the console
 * ```
 */
export function createTopic<T>(topicName: string): Topic<T> {
  const topicDebugName = `Topic<${topicName}>`;
  const topicDecorator: ParameterDecorator = function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ): void {
    // Error out if the topic decorator has been applied to a static method
    if (propertyKey !== undefined && typeof target === "function") {
      const member = `${target.name}.${String(propertyKey)}`;
      error(`decorator for ${topicDebugName} cannot be used on static member ${member}`);
    }

    // Error out if the topic decorator has been applied to a constructor
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
      // @ts-expect-error the topicName property is defined later in the createTopic function
      topic: topicDecorator,
      index: parameterIndex,
    });
  };

  (topicDecorator as any).topicName = topicDebugName;
  (topicDecorator as any).toString = () => topicDebugName;
  return topicDecorator as Topic<T>;
}
