/**
 * Plugin inline que substitui `import.meta` por um objeto seguro para web.
 * Necessario porque o Zustand devtools usa `import.meta.env.MODE` e o Metro
 * com perfil hermes-stable nao transpila import.meta para bundles web (ClassicJS).
 */
function importMetaPlugin() {
  return {
    visitor: {
      MetaProperty(path) {
        const { meta, property } = path.node;
        if (meta.name === 'import' && property.name === 'meta') {
          // Substitui import.meta por { env: {}, url: '' }
          path.replaceWithSourceString('({"env":{"MODE":"development"},"url":""})');
        }
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [importMetaPlugin],
  };
};
