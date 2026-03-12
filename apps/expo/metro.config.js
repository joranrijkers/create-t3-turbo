// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const { withNativewind } = require("nativewind/metro");

const projectRoot = __dirname;
const monorepoRoot = path.join(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.cacheStores = [
  new FileStore({
    root: path.join(projectRoot, "node_modules", ".cache", "metro"),
  }),
];

// Allow Metro to resolve modules from the monorepo root (pnpm symlinks)
config.watchFolders = [monorepoRoot];
config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.join(projectRoot, "node_modules"),
    path.join(monorepoRoot, "node_modules"),
  ],
  unstable_conditionNames: ["react-native", "require", "import"],
};

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = withNativewind(config);
