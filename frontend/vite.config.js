import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
      plugins: [
            react(),
            nodePolyfills(),
            basicSsl()
      ],
      build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                  output: {
                        manualChunks(id) {
                              if (id.includes('node_modules')) {
                                    if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
                                    if (id.includes('@livekit')) return 'livekit-vendor';
                                    if (id.includes('socket.io-client')) return 'socket-vendor';
                                    return 'vendor'; // all other node_modules
                              }
                        }
                  }
            }
      },
      server: {
            port: 3000,
            proxy: {
                  '/api': {
                        target: 'http://localhost:5000',
                        changeOrigin: true
                  },
                  '/socket.io': {
                        target: 'ws://localhost:5000',
                        ws: true
                  }
            }
      }
})
