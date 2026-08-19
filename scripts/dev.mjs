import { spawn } from 'node:child_process'
import path from 'node:path'

const cdn = 'https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@7455efae41b330c265e7cd4b78dfa848e7ce5ebd'
const packageManager = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm'

const env = {
  ...process.env,
  DATA_DIR: process.env.DATA_DIR || path.resolve('data-dev'),
  ORIGIN: process.env.ORIGIN || 'http://localhost:5173',
  RP_ID: process.env.RP_ID || 'localhost',
  VITE_IMG_BASE: process.env.VITE_IMG_BASE || `${cdn}/images/`,
  VITE_GIF_BASE: process.env.VITE_GIF_BASE || `${cdn}/videos/`
}

const child = spawn(packageManager, ['exec', 'turbo', 'run', 'dev', '--ui=stream'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe']
})

child.stdout.pipe(process.stdout)
child.stderr.pipe(process.stderr)

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
