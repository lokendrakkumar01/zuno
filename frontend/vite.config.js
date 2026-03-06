import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
      plugins: [
            react(),
            nodePolyfills()
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
                  }
            }
      }
})
