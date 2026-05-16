import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { brotliCompressSync } from 'node:zlib'

const brotliPlugin = () => ({
      name: 'zuno-brotli-assets',
      apply: 'build',
      generateBundle(_, bundle) {
            for (const [fileName, asset] of Object.entries(bundle)) {
                  if (!/\.(js|css|html|svg|json)$/.test(fileName)) continue
                  const source = asset.type === 'asset' ? asset.source : asset.code
                  if (!source) continue
                  this.emitFile({
                        type: 'asset',
                        fileName: `${fileName}.br`,
                        source: brotliCompressSync(Buffer.from(source))
                  })
            }
      }
})

export default defineConfig(({ command }) => ({
      plugins: [
            react(),
            brotliPlugin(),
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

                              if (id.includes('framer-motion')) {
                                    return 'motion';
                              }

                              if (
                                    id.includes('react-toastify') ||
                                    id.includes('date-fns')
                              ) {
                                    return 'ui-utils';
                              }

                              return 'vendor';
                        }
                  }
            },
            chunkSizeWarningLimit: 650
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
