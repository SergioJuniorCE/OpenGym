#!/usr/bin/env node
// Build the standalone Vite flavor and make its self-contained HTML available to Expo.

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..', '..', '..')
const packageManager = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm'

function run(args) {
  const result = spawnSync(packageManager, args, { cwd: root, stdio: 'inherit', env: process.env })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run(['--filter', 'opengym-frontend', 'build:mobile'])
run(['--filter', 'opengym-mobile', 'sync:web'])
