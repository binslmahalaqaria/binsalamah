import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // This new React Compiler rule flags the standard one-shot
      // "fetch on mount" pattern (useEffect(() => { load() }, [])) used
      // throughout the admin CRUD pages (lib/offers.ts, lib/leads.ts,
      // etc.) as if it caused cascading renders, even though these are
      // plain async loads with no actual render-loop issue. Downgraded to
      // a warning rather than reworked, since the standard pattern here
      // is simple and correct.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
