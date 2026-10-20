import { readdirSync } from "node:fs";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

// ── Architecture harness ─────────────────────────────────────────────────────
// These rules make AGENTS.md mechanical. If a rule blocks you, fix the design;
// do not disable the rule. See docs/adr/0002, 0003, 0009, 0010.

// Modules are discovered from the filesystem so new modules are covered
// automatically.
const MODULE_NAMES = readdirSync(new URL("./modules", import.meta.url), {
  withFileTypes: true,
})
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

// 1. Cross-module imports go through the target module's index.ts only.
//    Deep paths stay legal for passive surfaces: actions/, api/ (route
//    re-exports), schemas/, constants/, types/.
const crossModulePattern = (moduleName) => ({
  regex: `^@/modules/(?!${moduleName}(?:/|$))[a-z0-9-]+/(?!(?:.*/)?(?:actions|api|schemas|constants|types)(?:/|$)).+`,
  message:
    "Cross-module imports must use the module's index.ts public API (deep paths allowed only for actions/, api/, schemas/, constants/, types/).",
});

// 2. Prisma / the database client is reachable from repositories/ only.
const databasePattern = {
  group: ["@/shared/db/*", "@/generated/*", "@prisma/*"],
  message:
    "Database access belongs in modules/<name>/repositories/. Services call repositories; nothing else touches Prisma.",
};

// 3. Pure views/components never fetch, never read server state, never touch
//    stores. Containers and hooks do that and pass props down.
const viewPurityPattern = {
  group: [
    "@tanstack/react-query",
    "**/services/**",
    "**/store/**",
    "@/shared/lib/api-client",
    "@/shared/supabase/*",
    "zustand",
  ],
  message:
    "Components and views are pure: props in, markup out. Fetching and state belong in hooks wired by a screen container.",
};

const restrictImports = (...patterns) => ({
  "no-restricted-imports": ["error", { patterns }],
});

const perModule = MODULE_NAMES.flatMap((moduleName) => [
  {
    files: [`modules/${moduleName}/**/*.{ts,tsx}`],
    rules: restrictImports(crossModulePattern(moduleName), databasePattern),
  },
  {
    files: [`modules/${moduleName}/repositories/**/*.{ts,tsx}`],
    rules: restrictImports(crossModulePattern(moduleName)),
  },
  {
    files: [
      `modules/${moduleName}/components/**/*.{ts,tsx}`,
      `modules/${moduleName}/screens/!(*-container).tsx`,
    ],
    rules: restrictImports(
      crossModulePattern(moduleName),
      databasePattern,
      viewPurityPattern,
    ),
  },
]);

// ── Money, env and network guards ────────────────────────────────────────────
const MONEY_FILE = "lib/billing.ts";

const moneyMathRule = {
  "no-restricted-properties": [
    "error",
    ...["round", "floor", "ceil", "trunc"].map((property) => ({
      object: "Math",
      property,
      message: `Money math and rounding live in ${MONEY_FILE} only. Call a function from it.`,
    })),
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: "CallExpression[callee.property.name='toFixed']",
      message: `Do not format money with toFixed. Format sen with the shared money formatter; never toFixed.`,
    },
    {
      selector: "CallExpression[callee.name=/^(parseFloat)$/]",
      message: `Do not parse money with parseFloat. Use parseRinggitToSen() from ${MONEY_FILE}.`,
    },
    {
      selector: "MemberExpression[object.name='process'][property.name='env']",
      message: "Read configuration through env.ts, never process.env.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { fixStyle: "inline-type-imports" },
      ],
    },
  },
  {
    files: [
      "app/**/*.{ts,tsx}",
      "modules/**/*.{ts,tsx}",
      "shared/**/*.{ts,tsx}",
    ],
    ignores: ["**/*.test.{ts,tsx}", "shared/db/**"],
    rules: {
      ...restrictImports(databasePattern),
      ...moneyMathRule,
    },
  },
  ...perModule,
  // The one file allowed to do money math and rounding.
  {
    files: [MONEY_FILE],
    rules: {
      "no-restricted-properties": "off",
      "no-restricted-syntax": "off",
    },
  },
  // lib/billing.ts is pure and timezone-proof: it may import nothing and may not
  // use local-time Date methods, Intl or the current time. It receives `now`.
  {
    files: [MONEY_FILE],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: ".*",
              message: `${MONEY_FILE} must stay pure: no imports at all.`,
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^(getDate|getDay|getFullYear|getHours|getMinutes|getMonth|getSeconds|getMilliseconds|getTimezoneOffset|setDate|setFullYear|setHours|setMinutes|setMonth|setSeconds|setMilliseconds|toLocaleDateString|toLocaleString|toLocaleTimeString|toDateString|toTimeString)$/]",
          message:
            "Local-time Date APIs depend on the machine's TZ. Use integer day arithmetic.",
        },
        {
          selector: "NewExpression[callee.name='Date']",
          message: "Do not construct Dates here; `now` is passed in.",
        },
        {
          selector: "Identifier[name='Intl']",
          message: "Intl depends on the machine's locale and TZ.",
        },
      ],
    },
  },
  // Network: only the API client and adapters may call fetch directly.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "modules/**/*.{ts,tsx}",
      "shared/**/*.{ts,tsx}",
    ],
    ignores: [
      "shared/lib/api-client.ts",
      "modules/*/adapters/**",
      "**/*.test.{ts,tsx}",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Use the service layer (api from shared/lib/api-client). Provider calls belong in adapters/.",
        },
      ],
    },
  },
  // Disable ESLint rules that conflict with Prettier (must be last config).
  prettierConfig,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "generated/**",
    "next-env.d.ts",
    ".claude/**",
    // The brief's simulator, kept byte-for-byte.
    "gateway-sim.mjs",
  ]),
]);

export default eslintConfig;
