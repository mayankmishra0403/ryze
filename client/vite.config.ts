import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5001',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.WS_PROXY_TARGET || 'http://localhost:5001',
        ws: true,
      },
    },
  },
})
