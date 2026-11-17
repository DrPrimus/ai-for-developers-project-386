// Checks the production container: builds the root Dockerfile and runs the
// image twice — on a non-standard PORT and on PORT=8080 (the Hexlet contract).
// Each run waits for `/actuator/health` through nginx and verifies the SPA,
// its deep link and the API. Containers are always removed, including on
// failure. Only Node built-ins are used.
//
// Usage:
//   node scripts/docker-check.mjs

import { spawnSync } from 'node:child_process'
import process from 'node:process'

const IMAGE = 'ai-for-developers-project-386:local'
const CONTAINER_BASE = 'ai-for-developers-project-386-check'
const BUILD_TIMEOUT_MS = 20 * 60 * 1000
const HEALTH_TIMEOUT_MS = 5 * 60 * 1000
const POLL_INTERVAL_MS = 1000

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const color = {
  green: (text) => (useColor ? `\x1b[32m${text}\x1b[0m` : text),
  red: (text) => (useColor ? `\x1b[31m${text}\x1b[0m` : text),
  yellow: (text) => (useColor ? `\x1b[33m${text}\x1b[0m` : text),
  dim: (text) => (useColor ? `\x1b[2m${text}\x1b[0m` : text),
}

const OK = color.green('✔')
const FAIL = color.red('✖')

const scenarios = [
  { label: 'PORT=18080 (нестандартный порт)', port: 18080 },
  { label: 'PORT=8080 (контракт Хекслета)', port: 8080 },
]

function printHeader(title) {
  const line = '═'.repeat(64)
  console.log(`\n${line}`)
  console.log(`  ${title}`)
  console.log(line)
}

function printSummaryHeader(title, ok) {
  console.log('─'.repeat(64))
  console.log(`  ${title}: ${ok ? color.green('УСПЕШНО') : color.red('ПРОВАЛ')}`)
}

function printSummaryFooter() {
  console.log('─'.repeat(64))
}

function docker(args, options = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  })
}

function describeFailure(result) {
  if (result.error) return result.error.message
  const output = `${result.stderr ?? ''}${result.stdout ?? ''}`.trim()
  return output || `код выхода ${result.status}`
}

function isPortBusy(port) {
  const result = spawnSync(
    'lsof',
    ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'],
    { encoding: 'utf8' },
  )
  // lsof is not guaranteed (e.g. minimal images); an unavailable lsof must not
  // block the check — docker will report the port conflict itself.
  if (result.error) return false
  return result.status === 0
}

async function waitForHealth(port, container, deadline) {
  let lastError = 'нет ответа'
  while (Date.now() < deadline) {
    const running = docker([
      'inspect',
      '--format',
      '{{.State.Running}}',
      container,
    ])
    if (running.status === 0 && running.stdout.trim() !== 'true') {
      const logs = docker(['logs', '--tail', '60', container])
      throw new Error(
        `контейнер остановился до готовности\n${`${logs.stdout ?? ''}${logs.stderr ?? ''}`.trim()}`,
      )
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${port}/actuator/health`,
        { signal: AbortSignal.timeout(2000) },
      )
      if (response.ok) {
        const body = await response.json().catch(() => null)
        if (body?.status === 'UP') return
        lastError = `health вернул ${JSON.stringify(body)}`
      } else {
        lastError = `health ответил ${response.status}`
      }
    } catch (error) {
      lastError = error.cause?.code ?? error.message
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }

  const logs = docker(['logs', '--tail', '80', container])
  throw new Error(
    `health не поднялся за ${HEALTH_TIMEOUT_MS / 1000} с (${lastError})\n${`${
      logs.stdout ?? ''
    }${logs.stderr ?? ''}`.trim()}`,
  )
}

async function checkPage(port, path, label) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    signal: AbortSignal.timeout(5000),
  })
  const body = await response.text()
  if (response.status !== 200) {
    throw new Error(`${path}: ожидался 200, получен ${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('text/html')) {
    throw new Error(`${path}: ожидался HTML, получен ${contentType}`)
  }
  if (!body.includes('id="root"')) {
    throw new Error(`${path}: в HTML нет точки монтирования #root`)
  }
  return `${label} отдаёт HTML с #root`
}

async function checkMeetingTypes(port) {
  const response = await fetch(
    `http://127.0.0.1:${port}/api/meeting-types`,
    { signal: AbortSignal.timeout(5000) },
  )
  if (response.status !== 200) {
    throw new Error(`/api/meeting-types: ожидался 200, получен ${response.status}`)
  }
  const body = await response.json().catch(() => null)
  if (!body || !Array.isArray(body.items)) {
    throw new Error('/api/meeting-types: в JSON нет массива items')
  }
  return `API вернул ${body.items.length} типов встреч`
}

async function runScenario(scenario, index) {
  const { port, label } = scenario
  const container = `${CONTAINER_BASE}-${index}`
  const checks = []

  console.log(color.dim(`\n▸ ${label}`))

  docker(['rm', '-f', container])

  if (isPortBusy(port)) {
    return {
      label,
      ok: false,
      checks,
      error:
        `локальный порт ${port} уже занят — освободите его перед запуском ` +
        '(в CI порт свободен)',
    }
  }

  const started = docker([
    'run',
    '-d',
    '--rm',
    '--name',
    container,
    '-e',
    `PORT=${port}`,
    '-p',
    `127.0.0.1:${port}:${port}`,
    IMAGE,
  ])

  if (started.status !== 0) {
    const message = describeFailure(started)
    const busy = `${started.stderr ?? ''}`.includes('port is already allocated')
    return {
      label,
      ok: false,
      checks,
      error: busy
        ? `локальный порт ${port} уже занят Docker — освободите его перед запуском`
        : `docker run не удался: ${message}`,
    }
  }

  try {
    await waitForHealth(port, container, Date.now() + HEALTH_TIMEOUT_MS)
    checks.push({ name: `/actuator/health → UP`, ok: true })
    console.log(`  ${OK} /actuator/health → UP`)

    const pageChecks = [
      ['/', 'главная'],
      ['/booking', 'deep link /booking'],
    ]
    for (const [path, name] of pageChecks) {
      try {
        const detail = await checkPage(port, path, name)
        checks.push({ name: detail, ok: true })
        console.log(`  ${OK} ${detail}`)
      } catch (error) {
        checks.push({ name: `${path}: ${error.message}`, ok: false })
        console.log(`  ${FAIL} ${path}: ${error.message}`)
      }
    }

    try {
      const detail = await checkMeetingTypes(port)
      checks.push({ name: detail, ok: true })
      console.log(`  ${OK} ${detail}`)
    } catch (error) {
      checks.push({ name: error.message, ok: false })
      console.log(`  ${FAIL} ${error.message}`)
    }
  } catch (error) {
    checks.push({ name: error.message, ok: false })
    console.log(`  ${FAIL} ${error.message}`)
  } finally {
    docker(['rm', '-f', container])
  }

  return {
    label,
    ok: checks.length > 0 && checks.every((check) => check.ok),
    checks,
  }
}

async function main() {
  printHeader('DOCKER · сборка образа и запуск на PORT')

  console.log(color.dim(`\n▸ docker build -t ${IMAGE} .`))
  const buildStarted = Date.now()
  const build = docker(['build', '-t', IMAGE, '.'], {
    timeout: BUILD_TIMEOUT_MS,
  })
  const buildSeconds = ((Date.now() - buildStarted) / 1000).toFixed(1)
  const buildOk = build.status === 0
  const buildLine = buildOk
    ? `сборка ${IMAGE} за ${buildSeconds} с`
    : `сборка не удалась: ${describeFailure(build)}`
  console.log(`  ${buildOk ? OK : FAIL} ${buildLine}`)

  const results = []
  if (buildOk) {
    for (const [index, scenario] of scenarios.entries()) {
      results.push(await runScenario(scenario, index))
    }
  }

  const ok = buildOk && results.length > 0 && results.every((result) => result.ok)

  printSummaryHeader('СВОДКА DOCKER', ok)
  console.log(`  Образ: ${buildOk ? OK : FAIL} ${buildLine}`)
  if (results.length === 0) {
    console.log(`  Запуски: ${color.yellow('—')} не выполнялись`)
  }
  for (const result of results) {
    console.log(
      `  ${result.label}: ${result.ok ? OK : FAIL} ${
        result.ok
          ? result.checks.map((check) => check.name).join(' · ')
          : result.error ?? 'есть провалы (см. вывод выше)'
      }`,
    )
  }
  printSummaryFooter()

  if (!ok) {
    console.log(
      color.dim(
        '  Подсказка: образ должен стартовать без env, кроме PORT, и отдавать / через nginx.',
      ),
    )
  }

  process.exit(ok ? 0 : 1)
}

main().catch((error) => {
  console.error(`\n${FAIL} docker-check упал: ${error.stack ?? error.message}`)
  process.exit(1)
})
