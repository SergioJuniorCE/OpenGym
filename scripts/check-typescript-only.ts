#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const prohibitedSourceExtension = /\.(?:[cm]?js|jsx)$/i
const maintainedFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
)
  .split('\0')
  .filter(file => file && existsSync(file))

const javascriptFiles = maintainedFiles.filter(file => prohibitedSourceExtension.test(file))

if (javascriptFiles.length > 0) {
  console.error('Tracked JavaScript source is not allowed; migrate these files to TypeScript:')
  javascriptFiles.forEach(file => console.error(`  - ${file}`))
  process.exitCode = 1
} else {
  console.log('TypeScript-only check passed: no tracked JS, JSX, MJS, or CJS files.')
}
