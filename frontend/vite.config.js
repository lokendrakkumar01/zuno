import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
      plugins: [
            react(),
            VitePWA({
                  registerType: 'autoUpdate',
                  includeAssets: ['favicon.ico', 'robots.txt'],
                  manifest: {
                        name: 'ZUNO - Value Platform',
                        short_name: 'ZUNO',
                        description: 'A calm, value-focused platform for learning and growth',
                        theme_color: '#1a1a2e',
                        background_color: '#0f0f1a',
                        display: 'standalone',
                        icons: [
                              {
                                    src: '/icon-192.png',
                                    sizes: '192x192',
                                    type: 'image/png'
                              },
                              {
                                    src: '/icon-512.png',
                                    sizes: '512x512',
                                    type: 'image/png'
                              }
                        ]
                  }
            })
      ],
      server: {
            port: 3000,
            proxy: {
                  '/api': {
                        target: 'http://localhost:5000',
                        changeOrigin: true
                  }
            }
      }
})
