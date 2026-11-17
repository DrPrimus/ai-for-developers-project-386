import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

// E2E идёт на настоящих серверах: Spring Boot с хранилищем в памяти и собранный
// фронтенд, который проксирует /api на бэкенд. Каждый прогон поднимает новые
// процессы (reuseExistingServer: false), поэтому хранилище всегда пустое.
const feDir = import.meta.dirname
const root = path.resolve(feDir, '..')

const PREVIEW_URL = 'http://127.0.0.1:4173'
const BACKEND_URL = 'http://127.0.0.1:8080'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: PREVIEW_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      // Настоящий бэкенд; порт 8080 совпадает с proxy в vite.config.ts.
      command: 'BE/mvnw -f BE/pom.xml spring-boot:run',
      cwd: root,
      url: `${BACKEND_URL}/actuator/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    },
    {
      // Собранное приложение: `mise run e2e` собирает его перед запуском.
      command: 'npm run preview -- --port 4173 --strictPort',
      cwd: feDir,
      url: PREVIEW_URL,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
})
