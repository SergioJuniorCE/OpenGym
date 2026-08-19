const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)
// The mobile web build is flattened to one HTML asset before Expo starts. Metro needs
// to treat that file as a bundle asset rather than trying to parse it as JavaScript.
config.resolver.assetExts.push('html')

module.exports = config
