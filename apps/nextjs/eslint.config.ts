import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@prikkr/eslint-config/base";
import { nextjsConfig } from "@prikkr/eslint-config/nextjs";
import { reactConfig } from "@prikkr/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
