import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // Integration tests need local Supabase: run them with `pnpm test:int`.
    exclude: [...configDefaults.exclude, "**/*.int.test.ts"],
    passWithNoTests: true,
  },
});
