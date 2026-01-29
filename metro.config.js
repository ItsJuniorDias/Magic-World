const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// 🛠️ Adicione 'glb', 'gltf', 'png' e 'jpg' aqui:
config.resolver.assetExts.push("glb", "gltf", "png", "jpg");

module.exports = config;
