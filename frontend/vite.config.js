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
            sourcemap: false
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
