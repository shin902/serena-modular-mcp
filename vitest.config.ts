import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 73,
        functions: 80,
        lines: 85,
        statements: 85,
      },
      exclude: [
        "node_modules/**",
        "dist/**",
        "**/*.config.ts",
        "**/*.d.ts",
        "src/scripts/**",
      ],
    },
  },
});
