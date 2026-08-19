import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full checkouts of this same repo living inside it, so
    // without this every file gets linted once per worktree. Left unignored it
    // had already tripled the warning count — 8 real ones became 24 identical
    // ones — which is how a genuine new warning stops being noticeable.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
