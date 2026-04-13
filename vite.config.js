import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import base44 from '@base44/vite-plugin'

export default defineConfig({
  plugins: [react(), base44()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})