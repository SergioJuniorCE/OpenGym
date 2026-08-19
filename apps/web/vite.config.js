import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const mobile = mode === 'mobile' || process.env.VITE_MOBILE === '1'
  const backend = process.env.API_TARGET || 'http://127.0.0.1:3000'
  const media = process.env.MEDIA_TARGET || 'http://127.0.0.1:8888'

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
      // The Expo WebView receives one self-contained HTML asset. Keeping the normal
      // browser build split preserves its cacheability; only the mobile build is flattened.
      cssCodeSplit: !mobile,
      ...(mobile ? { rolldownOptions: { output: { codeSplitting: false } } } : {})
    }
  }
})
