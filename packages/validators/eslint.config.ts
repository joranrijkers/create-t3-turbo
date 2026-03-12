import { defineConfig } from "eslint/config";

import { baseConfig } from "@prikkr/eslint-config/base";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
);
