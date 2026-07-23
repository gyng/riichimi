const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push("onnx");

// Tile art is vector, so SVG is compiled into components rather than treated as
// a bitmap asset. Without moving it out of assetExts, Metro hands back an image
// reference that native cannot draw.
config.transformer.babelTransformerPath = require.resolve("react-native-svg-transformer");
config.resolver.assetExts = config.resolver.assetExts.filter((extension) => extension !== "svg");
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = config;
