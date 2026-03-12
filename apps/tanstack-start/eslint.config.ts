import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@prikkr/eslint-config/base";
import { reactConfig } from "@prikkr/eslint-config/react";

export default defineConfig(
  {
    ignores: [".nitro/**", ".output/**", ".tanstack/**"],
  },
  baseConfig,
  reactConfig,
  restrictEnvAccess,
);
