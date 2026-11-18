import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: loadEnv("test", process.cwd(), ""),
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
