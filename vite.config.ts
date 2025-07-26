import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/spectrum-analyzer/',
  esbuild: {
    target: 'esnext'
  },
  define: {
    global: 'globalThis',
  }
})
