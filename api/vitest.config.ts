import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/**/*.test.ts"],
    setupFiles: [],
    // Migration tests share a real PostgreSQL database; run files sequentially
    // to prevent concurrent beforeAll/afterAll teardowns from interfering.
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
