import { defineConfig } from 'vite'

export default defineConfig({
  // Relative base so it also works from a subfolder or plain static hosting.
  base: './',
  server: { port: 5173, host: '0.0.0.0' },
  build: { outDir: 'dist', target: 'es2020' }
})
