import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    host: true, // This makes the server accessible externally
    port: 5173, // Ensure it's running on the expected port
    middlewareMode: false,
  },
  build: {
    rollupOptions: {
      output: {
        // Garantir que o service worker seja copiado
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sw.js') {
            return 'sw.js'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  // Configuração para SPA - redirecionar todas as rotas para index.html
  appType: 'spa',
  publicDir: 'public'
})




