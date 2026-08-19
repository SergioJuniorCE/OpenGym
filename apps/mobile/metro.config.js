const { getDefaultConfig } = require('expo/metro-config')
const { join, resolve } = require('node:path')

const config = getDefaultConfig(__dirname)
const workspaceRoot = resolve(__dirname, '../..')

// The native app reuses the exercise catalogue from the workspace web package. Keep the
// catalogue as one source of truth while allowing Metro to resolve it from outside apps/mobile.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [join(__dirname, 'node_modules'), join(workspaceRoot, 'node_modules')]

module.exports = config
