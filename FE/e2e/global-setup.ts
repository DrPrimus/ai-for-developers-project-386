import { existsSync } from 'node:fs'
import path from 'node:path'

/**
 * E2E проверяет собранный фронтенд, а не dev-сервер. Сборка — отдельный шаг
 * (`mise run e2e` зависит от `fe-build`), поэтому без неё тест не запускаем.
 */
export default function globalSetup() {
  const index = path.resolve(import.meta.dirname, '..', 'dist', 'index.html')
  if (!existsSync(index)) {
    throw new Error(
      'Нет сборки фронтенда: FE/dist/index.html отсутствует. ' +
        'Выполните `mise run fe-build` или запускайте E2E через `mise run e2e`.',
    )
  }
}
