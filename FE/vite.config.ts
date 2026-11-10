import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

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
  },
  preview: {
    host: true,
    port: 80,
    strictPort: true,
  },
})
