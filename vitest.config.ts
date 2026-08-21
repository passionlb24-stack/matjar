import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests for the pure business-logic helpers in src/lib. Node environment
// (no DOM needed) — fast regression safety net that runs in CI.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` is a build-time marker with no standalone package on
      // disk, so node cannot resolve it and every file in src/lib/data — the
      // whole query layer, pure helpers included — was unreachable from a test.
      // See src/lib/__tests__/server-only-stub.ts.
      "server-only": fileURLToPath(
        new URL("./src/lib/__tests__/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
