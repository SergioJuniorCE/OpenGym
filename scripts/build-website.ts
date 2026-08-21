#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const websiteRoot = join(root, 'website')
const outputDirectory = join(websiteRoot, 'dist')

if (dirname(outputDirectory) !== websiteRoot) {
  throw new Error(`Refusing to replace unexpected website output path: ${outputDirectory}`)
}

rmSync(outputDirectory, { force: true, recursive: true })
mkdirSync(outputDirectory, { recursive: true })

for (const file of ['about.html', 'docs.html', 'index.html', 'styles.css'] as const) {
  copyFileSync(join(websiteRoot, file), join(outputDirectory, file))
}

const tscPath = resolve(root, 'node_modules/typescript/bin/tsc')
execFileSync(
  process.execPath,
  [tscPath, '-p', join(websiteRoot, 'tsconfig.build.json')],
  { cwd: root, stdio: 'inherit' },
)

const generatedSourcePath = join(outputDirectory, 'site.js')
if (!existsSync(generatedSourcePath)) {
  throw new Error(`TypeScript did not emit the expected website runtime: ${generatedSourcePath}`)
}

writeFileSync(
  generatedSourcePath,
  `// Generated from website/site.ts by scripts/build-website.ts — do not edit.\n${readFileSync(generatedSourcePath, 'utf8')}`,
  'utf8',
)

console.log(`Built static website in ${outputDirectory}`)
