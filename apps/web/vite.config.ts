import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [preact()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:4141',
      '/ws': {
        target: 'ws://127.0.0.1:4141',
        ws: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    cssMinify: 'lightningcss',
  },
})
