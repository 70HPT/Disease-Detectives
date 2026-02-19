import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy WHO GHO API requests through Vite dev server to bypass CORS
      '/who-api': {
        target: 'https://ghoapi.azureedge.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/who-api/, '/api'),
        secure: true,
      },
    },
  },
})