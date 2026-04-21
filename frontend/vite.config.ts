import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,      // Permite acesso externo
    port: 5173,      // Porta padrão de desenvolvimento
    strictPort: true,
  },
  preview: {
    host: true,      // Essencial para o Railway
    port: 3000,      // Porta que o Railway costuma usar para preview
    strictPort: true,
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      'invigorating-appreciation-production.up.railway.app' // Libera o domínio da nuvem
    ]
  }
})