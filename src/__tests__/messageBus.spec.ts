// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/no-unsafe-member-access */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AutoSubscribe } from "../autoSubscribe";
import { createMessageBus } from "../messageBus";
import { createTopic } from "../topic";

describe("MessageBus", () => {
  let messageBus = createMessageBus();
  const TestTopic = createTopic<string>("Test");

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    messageBus.dispose();
    messageBus = createMessageBus();
  });

  it("should publish a message", () => {
    const handler = vi.fn(() => {});
    messageBus.subscribe(TestTopic, handler);
    messageBus.publish(TestTopic, "it works");
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledExactlyOnceWith("it works");
  });

  it("should dispose subscription", () => {
    const handler = vi.fn(() => {});
    messageBus.subscribe(TestTopic, handler).dispose();
    messageBus.publish(TestTopic, "it works");
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledTimes(0);
  });

  it("should subscribe via @AutoSubscribe", () => {
    @AutoSubscribe(() => messageBus)
    class Example {
      data?: string;

      onTestTopic(@TestTopic() data: string): void {
        this.data = data;
      }
    }

    const example = new Example();
    messageBus.publish(TestTopic, "it works");

    vi.runAllTimers();
    expect(example.data).toBe("it works");
  });

  it("should throw if topic decorator is placed on constructor", () => {
    expect(() => {
      class Example {
        constructor(@TestTopic() _data: string) {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [message-bus] decorator for Topic<Test> cannot be used on Example's constructor]`,
    );
  });

  it("should throw if topic decorator is placed on static method", () => {
    expect(() => {
      class Example {
        static onTestTopic(@TestTopic() _data: string): void {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [message-bus] decorator for Topic<Test> cannot be used on static member Example.onTestTopic]`,
    );
  });

  it("should throw if multiple topics per method", () => {
    expect(() => {
      const AnotherTestTopic = createTopic<string>("AnotherTestTopic");
      class Example {
        onTestTopic(@TestTopic() _data1: string, @AnotherTestTopic() _data2: string): void {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [message-bus] only a single topic subscription is allowed on Example.onTestTopic]`,
    );
  });

  it("should throw if handler errors out", () => {
    expect(() => {
      messageBus.subscribe(TestTopic, () => {
        throw new Error("some error occurred");
      });

      messageBus.publish(TestTopic, "it works");
      vi.runAllTimers();
    }).toThrowErrorMatchingInlineSnapshot(
      `
      [Error: [message-bus] unhandled error in message handler
        [cause] some error occurred]
      `,
    );
  });

  it("should not throw if handler errors out and safePublishing is true", () => {
    const messageBus = createMessageBus({
      safePublishing: true,
    });

    messageBus.subscribe(TestTopic, () => {
      throw new Error("some error occurred");
    });

    vi.spyOn(console, "error").mockImplementation((...args: any[]) => {
      expect(args).toHaveLength(2);
      expect(args[0]).toBe("[message-bus] caught unhandled error in message handler (safePublishing: true).");
      expect(String(args[1])).toBe("Error: some error occurred");
    });

    // Should not let errors escape, but print to console.error instead
    messageBus.publish(TestTopic, "it works");
    vi.runAllTimers();
  });

  it("should not throw if handler errors out and safePublishing is true", () => {
    messageBus.subscribe(TestTopic, () => {});

    // We can call dispose() as many times we want
    messageBus.dispose();
    messageBus.dispose();

    expect(() => {
      messageBus.publish(TestTopic, "it does not work");
      vi.runAllTimers();
    }).toThrowErrorMatchingInlineSnapshot(`[Error: [message-bus] the message bus is disposed]`);
  });

  it("should propagate message to child buses (recursively)", () => {
    const handler = vi.fn(() => {});
    messageBus.subscribe(TestTopic, handler);

    const childBus1 = messageBus.createChildBus();
    const childHandler1 = vi.fn(() => {});
    childBus1.subscribe(TestTopic, childHandler1);

    const childBus2 = messageBus.createChildBus();
    const childHandler2 = vi.fn(() => {});
    childBus2.subscribe(TestTopic, childHandler2);

    const childBus3 = childBus2.createChildBus();
    const childHandler3 = vi.fn(() => {});
    childBus3.subscribe(TestTopic, childHandler3);

    messageBus.publish(TestTopic, "it works");
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledExactlyOnceWith("it works");
    expect(childHandler1).toHaveBeenCalledExactlyOnceWith("it works");
    expect(childHandler2).toHaveBeenCalledExactlyOnceWith("it works");
    expect(childHandler3).toHaveBeenCalledExactlyOnceWith("it works");
    expect(childHandler1).toHaveBeenCalledAfter(handler);
    expect(childHandler2).toHaveBeenCalledAfter(handler);
    expect(childHandler3).toHaveBeenCalledAfter(childHandler1);
    expect(childHandler3).toHaveBeenCalledAfter(childHandler2);
  });

  it("should propagate message to parent bus (not recursively)", () => {
    const ParentTestTopic = createTopic<string>("ParentTestTopic", "parent");
    const handler = vi.fn(() => {});
    messageBus.subscribe(ParentTestTopic, handler);

    const childBus = messageBus.createChildBus();
    const childHandler = vi.fn(() => {});
    childBus.subscribe(ParentTestTopic, childHandler);

    const childBus2 = childBus.createChildBus();
    const childHandler2 = vi.fn(() => {});
    childBus2.subscribe(ParentTestTopic, childHandler2);

    childBus2.publish(ParentTestTopic, "it works");
    vi.runAllTimers();

    expect(childHandler2).toHaveBeenCalledExactlyOnceWith("it works");
    expect(childHandler).toHaveBeenCalledExactlyOnceWith("it works");
    expect(childHandler).toHaveBeenCalledAfter(childHandler2);
    expect(handler).toHaveBeenCalledTimes(0);
  });

  it("should receive messages asynchronously", async () => {
    vi.useRealTimers();

    let str = "";
    const subscription = messageBus.subscribe(TestTopic);
    const iterations = (async () => {
      let i = 0;

      for await (const message of subscription) {
        str += message;

        if (++i === 3) {
          subscription.dispose();
          break;
        }
      }
    })();

    messageBus.publish(TestTopic, "one");
    messageBus.publish(TestTopic, "two");
    messageBus.publish(TestTopic, "three");

    await iterations;

    // noinspection SpellCheckingInspection
    expect(str).toBe("onetwothree");
    expect((subscription as any).isDisposed).toBe(true);
  });

  it("should await single messages", async () => {
    vi.useRealTimers();

    let str = "";
    const subscription = messageBus.subscribe(TestTopic);
    const singles = (async () => {
      str += await subscription.single();
      str += await subscription.single();
      subscription.dispose();
    })();

    messageBus.publish(TestTopic, "one");
    messageBus.publish(TestTopic, "two");
    await singles;

    // noinspection SpellCheckingInspection
    expect(str).toBe("onetwo");
    expect((subscription as any).isDisposed).toBe(true);
  });

  it("should consider subscription priority", () => {
    const handler1 = vi.fn(() => {});
    messageBus.subscribe(TestTopic, handler1).setPriority(2);

    const handler2 = vi.fn(() => {});
    messageBus.subscribe(TestTopic, handler2);

    const handler3 = vi.fn(() => {});
    messageBus.subscribe(TestTopic, handler3).setPriority(0);

    messageBus.publish(TestTopic, "one");
    vi.runAllTimers();

    expect(handler2).toHaveBeenCalledBefore(handler1);
    expect(handler3).toHaveBeenCalledBefore(handler1);
    expect(handler3).toHaveBeenCalledBefore(handler2);
  });

  it("should dispose itself and children", () => {
    const childBus = messageBus.createChildBus();
    expect(messageBus.isDisposed).toBe(false);
    expect(childBus.isDisposed).toBe(false);

    messageBus.dispose();

    expect(messageBus.isDisposed).toBe(true);
    expect(childBus.isDisposed).toBe(true);
  });
});
