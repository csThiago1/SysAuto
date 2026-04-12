const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Monorepo: inclui node_modules do root (obrigatório — pacotes hoistados ficam aqui)
// e packages/ (onde fica @paddock/types).
// Não assistir apps/ ou backend/ — evita refresh loop com Next.js/Django.
config.watchFolders = [
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'packages'),
];

// Monorepo: resolve pacotes do root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Suporte a package.json "exports" field (necessario para reanimated/worklets)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
