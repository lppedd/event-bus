// noinspection JSUnusedLocalSymbols,JSUnusedGlobalSymbols
/* eslint-disable @typescript-eslint/no-unused-vars */

import { afterEach, describe, expect, it } from "vitest";

import { AutoSubscribe } from "../autoSubscribe";
import { createEventBus } from "../eventBus";
import { createTopic } from "../topic";

describe("EventBus", () => {
  let eventBus = createEventBus();
  const TestTopic = createTopic<string>("Test");

  afterEach(() => {
    eventBus.dispose();
    eventBus = createEventBus();
  });

  it("should publish an event", () => {
    let testData = "";
    eventBus.subscribe(TestTopic, (data) => (testData = data));
    eventBus.publish(TestTopic, "it works");
    expect(testData).toBe("it works");
  });

  it("should dispose subscription", () => {
    let testData = "";
    eventBus.subscribe(TestTopic, (data) => (testData = data)).dispose();
    eventBus.publish(TestTopic, "it works");
    expect(testData).toBe("");
  });

  it("should subscribe via decorator", () => {
    @AutoSubscribe(eventBus)
    class Example {
      data?: string;

      onTestTopic(@TestTopic data: string): void {
        this.data = data;
      }
    }

    const example = new Example();
    eventBus.publish(TestTopic, "it works");
    expect(example.data).toBe("it works");
  });

  it("should throw if topic decorator is placed on constructor", () => {
    expect(() => {
      class Example {
        constructor(@TestTopic _data: string) {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [event-bus] decorator for Topic<Test> cannot be used on Example's constructor]`,
    );
  });

  it("should throw if topic decorator is placed on static method", () => {
    expect(() => {
      class Example {
        static onTestTopic(@TestTopic _data: string): void {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [event-bus] decorator for Topic<Test> cannot be used on static member Example.onTestTopic]`,
    );
  });

  it("should throw if multiple topics per method", () => {
    expect(() => {
      const TestTopic2 = createTopic<string>("Test2");

      class Example {
        onTestTopic(@TestTopic _data: string, @TestTopic2 _data2: string): void {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [event-bus] only a single topic registration is allowed on Example.onTestTopic]`,
    );
  });

  it("should throw if multiple topics per method", () => {
    expect(() => {
      const TestTopic2 = createTopic<string>("Test2");

      class Example {
        onTestTopic(@TestTopic _data: string, @TestTopic2 _data2: string): void {}
      }
    }).toThrowErrorMatchingInlineSnapshot(
      `[Error: [event-bus] only a single topic registration is allowed on Example.onTestTopic]`,
    );
  });

  it("should throw if handler errors out", () => {
    expect(() => {
      eventBus.subscribe(TestTopic, () => {
        throw new Error("some error occurred");
      });

      eventBus.publish(TestTopic, "it works");
    }).toThrowErrorMatchingInlineSnapshot(
      `
      [Error: [event-bus] an event handler did not complete correctly
        [cause] some error occurred]
      `,
    );
  });

  it("should not throw if handler errors out and safePublishing is true", () => {
    const eventBus = createEventBus({
      safePublishing: true,
    });

    eventBus.subscribe(TestTopic, () => {
      throw new Error("some error occurred");
    });

    // Should not let errors escape, but print to console.error instead
    eventBus.publish(TestTopic, "it works");
  });

  it("should not throw if handler errors out and safePublishing is true", () => {
    eventBus.subscribe(TestTopic, () => {});

    // We can call dispose() as many times we want
    eventBus.dispose();
    eventBus.dispose();

    expect(() => eventBus.publish(TestTopic, "it does not work")).toThrowErrorMatchingInlineSnapshot(
      `[Error: [event-bus] the event bus is disposed]`,
    );
  });
});
