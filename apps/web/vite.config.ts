import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { createMediaMiddleware } from './src/lib/dev-media.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backend = process.env.API_TARGET || env.API_TARGET || 'http://127.0.0.1:3000'
  const media = process.env.MEDIA_TARGET || env.MEDIA_TARGET
  const localMedia = {
    name: 'opengym-local-media',
    configureServer(server) {
      server.middlewares.use(createMediaMiddleware(new URL('../../media/', import.meta.url)))
    },
  }

  return {
    plugins: [react(), ...(media ? [] : [localMedia])],
    base: './',
    server: {
      proxy: {
        '/api': { target: backend, changeOrigin: true },
        ...(media ? {
          '/img': { target: media, changeOrigin: true },
          '/gif': { target: media, changeOrigin: true },
        } : {}),
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
