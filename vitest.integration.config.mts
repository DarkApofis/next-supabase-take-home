import { defineConfig } from "vitest/config";

// Runs against local Supabase (pnpm setup:env && pnpx supabase db reset first).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.int.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
  },
});
