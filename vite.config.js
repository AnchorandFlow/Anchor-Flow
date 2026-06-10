import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019',
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://www.anchorandflowapp.com',
        changeOrigin: true,
      },
    },
  },
})
