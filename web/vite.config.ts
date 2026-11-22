import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Urban Mine',
        short_name: 'Urban Mine',
        description: 'Worker-first e-waste app (prototype, sample data)',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/downloads\//, /^\/\.well-known\//],
        // Offline: show the last data seen. Live data first; the saved copy only when there is no network.
        runtimeCaching: [
          { urlPattern: ({ url, request }) => request.method === 'GET' && url.pathname.startsWith('/api/') && !url.pathname.includes('/auth'),
            handler: 'NetworkFirst', options: { cacheName: 'api', networkTimeoutSeconds: 6, expiration: { maxEntries: 200, maxAgeSeconds: 7 * 86400 } } },
          { urlPattern: /\/models\/|ort-wasm.*\.(wasm|mjs)$/, handler: 'CacheFirst', options: { cacheName: 'models', expiration: { maxEntries: 20 } } },
        ],
        globIgnores: ['**/models/**', '**/*.wasm', '**/ort-wasm*', '**/*.br', '**/*.gz'],
      },
    }),
  ],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
})
