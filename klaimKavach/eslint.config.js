import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  { files: ["**/*.{ts,tsx}"] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooksPlugin.configs.flat["recommended-latest"],
];
