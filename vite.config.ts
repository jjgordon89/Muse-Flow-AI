import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.openai.com https://api.anthropic.com https://openrouter.ai https://api-inference.huggingface.co http://localhost:11434 http://localhost:1234; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests;"
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react', '@lancedb/lancedb'],
  },
  define: {
    // Define global variables for Node.js modules that don't work in browser
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      external: ['@lancedb/lancedb'],
    },
  },
});
