import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Robo Filler',
        short_name: 'Robo Filler',
        description: 'Vyhledávání artiklů a Karel Bot AI asistent',
        theme_color: '#1e1e2e',
        background_color: '#1e1e2e',
        display: 'standalone',
        lang: 'cs',
        start_url: '/robo-filler/',
        scope: '/robo-filler/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\.csv(\?.*)?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'csv-data',
              expiration: { maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  base: '/robo-filler/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'xlsx-vendor': ['xlsx'],
          'search-vendor': ['fuse.js']
        }
      }
    }
  }
})
