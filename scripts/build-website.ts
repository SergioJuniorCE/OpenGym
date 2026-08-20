#!/usr/bin/env node

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

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

const sourcePath = join(websiteRoot, 'site.ts')
const source = readFileSync(sourcePath, 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
    verbatimModuleSyntax: true,
  },
  fileName: sourcePath,
  reportDiagnostics: true,
})

const errors = transpiled.diagnostics?.filter(
  diagnostic => diagnostic.category === ts.DiagnosticCategory.Error,
)
if (errors?.length) {
  throw new Error(
    ts.formatDiagnostics(errors, {
      getCanonicalFileName: fileName => fileName,
      getCurrentDirectory: () => root,
      getNewLine: () => '\n',
    }),
  )
}

writeFileSync(
  join(outputDirectory, 'site.js'),
  `// Generated from website/site.ts by scripts/build-website.ts — do not edit.\n${transpiled.outputText}`,
  'utf8',
)

console.log(`Built static website in ${outputDirectory}`)
