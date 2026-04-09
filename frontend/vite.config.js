import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig(({ command }) => ({
      plugins: [
            react(),
            nodePolyfills(),
            // basicSsl is dev-only — only load during `vite dev`, not during `vite build`
            ...(command === 'serve' ? [basicSsl()] : [])
      ],
      build: {
            outDir: 'dist',
            sourcemap: false,
            rollupOptions: {
                  output: {
                        manualChunks(id) {
                              if (!id.includes('node_modules')) return;

                              if (id.includes('livekit')) {
                                    return 'livekit';
                              }

                              if (id.includes('framer-motion')) {
                                    return 'motion';
                              }

                              return 'vendor';
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
}))
