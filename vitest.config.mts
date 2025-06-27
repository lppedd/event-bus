import { coverageConfigDefaults, defineConfig } from "vitest/config";

// @internal
export default defineConfig({
  test: {
    coverage: {
      all: false,
      exclude: [...coverageConfigDefaults.exclude],
    },
  },
});
