const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

/**
 * The whole point of keeping this app inside the web repo: it imports the
 * domain layer directly instead of owning a copy that drifts. Metro only walks
 * its own folder by default, so it has to be told the repo root exists.
 */
config.watchFolders = [workspaceRoot];

/**
 * Dependencies come from this app and nowhere else. The repo root has its own
 * node_modules with a React built for the DOM; adding it here would let a
 * bundle end up with two Reacts, which breaks hooks at runtime in a way that
 * is miserable to diagnose.
 *
 * The shared layer imports nothing but itself, so it needs no resolution help
 * — but pinning the singletons costs nothing and removes the whole class of
 * problem if that ever stops being true.
 */
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, "node_modules")];
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(projectRoot, "node_modules/react-native"),
};

module.exports = config;
