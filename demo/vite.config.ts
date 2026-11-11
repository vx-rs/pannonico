// Imports
// -----------------------------------------------------------------------------
// External
import { defineConfig } from 'vite'

// Config
// -----------------------------------------------------------------------------
export default defineConfig({
  base: './',
  server: {
    host: '127.0.0.1',
    origin: 'http://127.0.0.1:5173',
    port: 5173,
    strictPort: true,
    cors: {
      origin: 'http://127.0.0.1:3000',
    },
  },
  css: {
    transformer: 'lightningcss',
  },
  build: {
    assetsInlineLimit: 0,
    cssMinify: 'lightningcss',
    manifest: true,
    outDir: '.pannonico/vite',
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        app: 'src/app.ts',
      },
    },
  },
})
