import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

/**
 * Public site URL used for canonical links, Open Graph, sitemap and robots.txt.
 * Set SITE_URL for a custom domain; on Vercel the production URL is picked up automatically.
 */
const SITE_URL = (
  process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '') ||
  'http://localhost:5173'
).replace(/\/$/, '')

export default defineConfig({
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(SITE_URL) },
  // Relative asset paths only for the hash-routed static build (works from any folder / file host).
  base: process.env.VITE_ROUTER === 'hash' || process.env.VITE_ROUTER === 'memory' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', SITE_URL) },
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'ui', test: /node_modules[\\/](@radix-ui|sonner|@floating-ui|lucide-react)/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
