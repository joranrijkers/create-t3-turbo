import { defineConfig } from "eslint/config";

import { baseConfig } from "@prikkr/eslint-config/base";
import { reactConfig } from "@prikkr/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**"],
  },
  baseConfig,
  reactConfig,
);
