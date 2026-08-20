import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = process.env.API_TARGET || env.API_TARGET || 'http://127.0.0.1:3000'
  const media = process.env.MEDIA_TARGET || env.MEDIA_TARGET || 'http://127.0.0.1:8888'

  return {
    plugins: [react()],
    base: './',
    server: {
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        '/img': { target: media, changeOrigin: true },
        '/gif': { target: media, changeOrigin: true }
      }
    },
    build: {
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: {
          app: fileURLToPath(new URL('./index.html', import.meta.url)),
          sw: fileURLToPath(new URL('./src/sw.ts', import.meta.url))
        },
        output: {
          entryFileNames: chunk => chunk.name === 'sw'
            ? 'sw.js'
            : 'assets/[name]-[hash].js'
        }
      }
    }
  }
})
