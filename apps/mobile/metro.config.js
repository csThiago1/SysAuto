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

// DOM components ('use dom') sao bundles platform=web e exigem react === react-dom.
// O nativo fixa react 19.2.0 (renderer do RN 0.83) em apps/mobile/node_modules, mas o
// unico react-dom e o da raiz (19.2.5). No web, resolve react pela raiz, junto do react-dom.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && /^react(\/|$)/.test(moduleName)) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [monorepoRoot] }) };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
