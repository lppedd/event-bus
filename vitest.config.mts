import { coverageConfigDefaults, defineConfig } from "vitest/config";

// @internal
export default defineConfig({
  test: {
    fakeTimers: {
      toFake: ["nextTick", "queueMicrotask"],
    },
    coverage: {
      all: false,
      exclude: [...coverageConfigDefaults.exclude],
    },
  },
});
