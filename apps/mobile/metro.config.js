const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: assiste apenas packages/ (onde fica @paddock/types)
// NAO assistir o root inteiro — causaria refresh loop (Next.js, Django, etc)
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
];

// Monorepo: resolve pacotes do root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Suporte a package.json "exports" field (necessario para reanimated/worklets)
config.resolver.unstable_enablePackageExports = true;

// NOTA: unstable_transformProfile nao e definido aqui — o Expo CLI
// aplica 'hermes-stable' automaticamente para native e 'default' para web.

module.exports = config;
