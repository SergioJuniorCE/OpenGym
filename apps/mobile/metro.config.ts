import { getDefaultConfig } from 'expo/metro-config.js'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { withUniwindConfig } from 'uniwind/metro'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

// The native app reuses the exercise catalogue from the workspace web package. Keep the
// catalogue as one source of truth while allowing Metro to resolve it from outside apps/mobile.
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  join(projectRoot, 'node_modules'),
  join(workspaceRoot, 'node_modules'),
]

// Uniwind declares Metro's upstream ConfigT while Expo returns its compatible fork of
// that config. The objects have the same runtime contract even though their resolver
// callback types originate from different packages.
const uniwindConfig = config as unknown as Parameters<typeof withUniwindConfig>[0]

export default withUniwindConfig(uniwindConfig, {
  cssEntryFile: './src/global.css',
  dtsFile: './src/uniwind-types.d.ts',
})
