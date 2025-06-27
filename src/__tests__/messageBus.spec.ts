// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, describe, expect, it } from "vitest";

import { AutoSubscribe } from "../autoSubscribe";
import { createMessageBus } from "../messageBus";
import { createTopic } from "../topic";

describe("MessageBus", () => {
  let messageBus = createMessageBus();
  const TestTopic = createTopic<string>("Test");

  afterEach(() => {
    messageBus.dispose();
    messageBus = createMessageBus();
  });

  it("should publish a message", () => {
    let testData = "";
    messageBus.subscribe(TestTopic, (data) => (testData = data));
    messageBus.publish(TestTopic, "it works");
    expect(testData).toBe("it works");
  });

  it("should dispose subscription", () => {
    let testData = "";
    messageBus.subscribe(TestTopic, (data) => (testData = data)).dispose();
    messageBus.publish(TestTopic, "it works");
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
  });

  it("should not throw if handler errors out and safePublishing is true", () => {
    messageBus.subscribe(TestTopic, () => {});

    // We can call dispose() as many times we want
    messageBus.dispose();
    messageBus.dispose();

    expect(() => messageBus.publish(TestTopic, "it does not work")).toThrowErrorMatchingInlineSnapshot(
      `[Error: [message-bus] the message bus is disposed]`,
    );
  });

  it("should dispose", () => {
    expect(messageBus.isDisposed).toBe(false);
    messageBus.dispose();
    expect(messageBus.isDisposed).toBe(true);
  });
});
