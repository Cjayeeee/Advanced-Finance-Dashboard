import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  // Relative asset paths only for the hash-routed static build (works from any folder / file host).
  base: process.env.VITE_ROUTER === 'hash' || process.env.VITE_ROUTER === 'memory' ? './' : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'charts', test: /node_modules[\\/](recharts|d3-|victory-vendor|es-toolkit|decimal\.js|@reduxjs|immer|reselect|redux)/ },
            { name: 'ui', test: /node_modules[\\/](@radix-ui|sonner|@floating-ui|lucide-react)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
