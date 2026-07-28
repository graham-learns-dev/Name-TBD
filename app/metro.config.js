const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const repoRoot = path.resolve(__dirname, '..');

/**
 * The app consumes @formcheck/rule-engine (a symlinked file: dependency) and the
 * program template JSONs, both living outside app/. Metro must watch the repo root
 * to see the symlink target, and resolve modules from the app's own node_modules.
 * https://docs.expo.dev/guides/monorepos/
 */
const config = getDefaultConfig(__dirname);

config.watchFolders = [repoRoot];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];

module.exports = config;
