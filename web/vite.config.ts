import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

const ORT_VERSION = JSON.parse(readFileSync(new URL('./node_modules/onnxruntime-web/package.json', import.meta.url), 'utf8')).version

export default defineConfig({
  define: { __ORT_VERSION__: JSON.stringify(ORT_VERSION) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Urban Mine',
        short_name: 'Urban Mine',
        description: 'Worker-first e-waste app (prototype, sample data)',
        theme_color: '#14171A',
        background_color: '#F4F3EF',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/],
        // Offline: show the last data seen. Live data first; the saved copy only when there is no network.
        runtimeCaching: [
          { urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/') && !url.pathname.includes('/auth'),
            handler: 'NetworkFirst', options: { cacheName: 'api', networkTimeoutSeconds: 6, expiration: { maxEntries: 200, maxAgeSeconds: 7 * 86400 } } },
          { urlPattern: /\/(models|ort)\//, handler: 'CacheFirst', options: { cacheName: 'models', expiration: { maxEntries: 20 } } },
        ],
        globIgnores: ['**/models/**', '**/ort/**', '**/*.br', '**/*.gz'],
      },
    }),
  ],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
})
