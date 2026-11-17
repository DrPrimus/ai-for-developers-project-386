// Проверяет, что TypeSpec компилируется, а сгенерированные артефакты
// (OpenAPI и типы фронтенда) соответствуют исходникам.
//
// Сравнение идёт с временными файлами, а не через git diff: гейт должен
// работать и до первого коммита, и в pre-commit с грязным рабочим деревом.

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.resolve(apiDir, '..')
const committedOpenapi = path.join(apiDir, 'openapi', 'openapi.yaml')
const committedTypes = path.join(root, 'FE', 'src', 'api', 'schema.d.ts')

const ok = (text) => `\x1b[32m${text}\x1b[0m`
const fail = (text) => `\x1b[31m${text}\x1b[0m`

function run(command, args, cwd) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk))
    child.stderr.on('data', (chunk) => (stderr += chunk))
    child.on('error', (error) => resolve({ code: 1, stdout, stderr: error.message }))
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }))
  })
}

const tmp = await mkdtemp(path.join(os.tmpdir(), 'calendar-api-'))
let failed = false

try {
  const compile = await run(
    path.join(apiDir, 'node_modules', '.bin', 'tsp'),
    ['compile', '.', '--output-dir', path.join(tmp, 'openapi')],
    apiDir,
  )

  if (compile.code !== 0) {
    failed = true
    console.log(`${fail('✖')} TypeSpec: компиляция провалена`)
    console.log(compile.stdout + compile.stderr)
  } else {
    console.log(`${ok('✔')} TypeSpec: компиляция успешна`)
  }

  if (!failed) {
    const freshOpenapi = await readFile(path.join(tmp, 'openapi', 'openapi.yaml'), 'utf8')
    const currentOpenapi = await readFile(committedOpenapi, 'utf8').catch(() => null)

    if (currentOpenapi === freshOpenapi) {
      console.log(`${ok('✔')} OpenAPI: api/openapi/openapi.yaml актуален`)
    } else {
      failed = true
      console.log(`${fail('✖')} OpenAPI устарел: api/openapi/openapi.yaml не совпадает с TypeSpec`)
    }
  }

  if (!failed) {
    const types = await run(
      path.join(apiDir, 'node_modules', '.bin', 'openapi-typescript'),
      [committedOpenapi, '-o', path.join(tmp, 'schema.d.ts')],
      apiDir,
    )

    if (types.code !== 0) {
      failed = true
      console.log(`${fail('✖')} Типы фронтенда: генерация провалена`)
      console.log(types.stdout + types.stderr)
    } else {
      const freshTypes = await readFile(path.join(tmp, 'schema.d.ts'), 'utf8')
      const currentTypes = await readFile(committedTypes, 'utf8').catch(() => null)

      if (currentTypes === freshTypes) {
        console.log(`${ok('✔')} Типы фронтенда: FE/src/api/schema.d.ts актуальны`)
      } else {
        failed = true
        console.log(`${fail('✖')} Типы фронтенда устарели: FE/src/api/schema.d.ts не совпадает с OpenAPI`)
      }
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true })
}

if (failed) {
  console.log('\nЗапустите `mise run api-generate`, чтобы пересобрать артефакты.')
  process.exitCode = 1
} else {
  console.log('\nКонтракт API в порядке.')
}
