const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Adiciona 'glb' e 'gltf' na lista de arquivos permitidos
config.resolver.assetExts.push("glb", "gltf");

module.exports = config;
