// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols
/* eslint-disable @typescript-eslint/no-unused-vars */

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
    let testData = "";
    messageBus.subscribe(TestTopic, (data) => (testData = data));
    messageBus.publish(TestTopic, "it works");

    vi.runAllTimers();
    expect(testData).toBe("it works");
  });

  it("should dispose subscription", () => {
    let testData = "";
    messageBus.subscribe(TestTopic, (data) => (testData = data)).dispose();
    messageBus.publish(TestTopic, "it works");

    vi.runAllTimers();
    expect(testData).toBe("");
  });

  it("should subscribe via @AutoSubscribe", () => {
    @AutoSubscribe(messageBus)
    class Example {
      data?: string;

      onTestTopic(@TestTopic data: string): void {
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
        constructor(@TestTopic _data: string) {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [message-bus] decorator for Topic<Test> cannot be used on Example's constructor]`,
    );
  });

  it("should throw if topic decorator is placed on static method", () => {
    expect(() => {
      class Example {
        static onTestTopic(@TestTopic _data: string): void {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [message-bus] decorator for Topic<Test> cannot be used on static member Example.onTestTopic]`,
    );
  });

  it("should throw if multiple topics per method", () => {
    expect(() => {
      const TestTopic2 = createTopic<string>("Test2");

      class Example {
        onTestTopic(@TestTopic _data: string, @TestTopic2 _data2: string): void {}
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
      [Error: [message-bus] a message handler did not complete correctly
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

    messageBus.publish(TestTopic, "it works");
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledOnce();
    expect(childHandler1).toHaveBeenCalledOnce();
    expect(childHandler2).toHaveBeenCalledOnce();

    expect(handler).toHaveBeenCalledWith("it works");
    expect(childHandler1).toHaveBeenCalledWith("it works");
    expect(childHandler2).toHaveBeenCalledWith("it works");

    expect(childHandler1).toHaveBeenCalledAfter(handler);
    expect(childHandler2).toHaveBeenCalledAfter(handler);
  });

  it("should propagate message to parent bus (not recursively)", () => {
    const topic = createTopic<string>("ParentTestTopic", "parent");

    const handler = vi.fn(() => {});
    messageBus.subscribe(topic, handler);

    const childBus = messageBus.createChildBus();
    const childHandler = vi.fn(() => {});
    childBus.subscribe(topic, childHandler);

    childBus.publish(topic, "it works");
    vi.runAllTimers();

    expect(handler).toHaveBeenCalledOnce();
    expect(childHandler).toHaveBeenCalledOnce();

    expect(handler).toHaveBeenCalledWith("it works");
    expect(childHandler).toHaveBeenCalledWith("it works");

    expect(childHandler).toHaveBeenCalledBefore(handler);
  });

  it("should dispose", () => {
    expect(messageBus.isDisposed).toBe(false);
    messageBus.dispose();
    expect(messageBus.isDisposed).toBe(true);
  });
});
