import { defineConfig } from "vitest/config";

// Explicit config so vitest doesn't walk up and pick the web app's jsdom/React config from the repo root.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
