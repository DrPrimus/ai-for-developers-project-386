import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Порт 80 требует прав root на macOS, если слушать конкретный адрес
    // (127.0.0.1/::1). Слушаем все интерфейсы — так порт доступен без sudo.
    host: true,
    port: 80,
    strictPort: true,
    // В dev API живёт на бэкенде; в production фронтенд и API — один origin.
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
  preview: {
    host: true,
    port: 80,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
