import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(process.cwd(), 'src') },
  },
  server: {
    port: 5173,
    // Descomenta si prefieres llamar al backend por ruta relativa (/api/...)
    // en lugar de por URL absoluta, evitando configurar CORS en Nest.
    // proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true } },
  },
})
