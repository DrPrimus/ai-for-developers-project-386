// Runs the project quality gates and prints a human-readable summary for each
// part (backend / frontend) plus a final total.
//
// Reports are not written to disk: test counts are parsed from the regular
// console output of Maven Surefire and Vitest. If the format cannot be parsed,
// the summary says so, but the exit code still reflects the real result.
//
// Usage:
//   node scripts/check.mjs        # backend + frontend
//   node scripts/check.mjs be     # backend only
//   node scripts/check.mjs fe     # frontend only

import { spawn } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2] ?? 'all'

if (!['all', 'be', 'fe'].includes(mode)) {
  console.error(`Неизвестный режим: ${mode}. Используйте all, be или fe.`)
  process.exit(2)
}

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

const color = {
  green: (text) => (useColor ? `\x1b[32m${text}\x1b[0m` : text),
  red: (text) => (useColor ? `\x1b[31m${text}\x1b[0m` : text),
  yellow: (text) => (useColor ? `\x1b[33m${text}\x1b[0m` : text),
  dim: (text) => (useColor ? `\x1b[2m${text}\x1b[0m` : text),
}

const OK = color.green('✔')
const FAIL = color.red('✖')
const SKIP = color.yellow('—')

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')

function printHeader(title) {
  const line = '═'.repeat(64)
  console.log(`\n${line}`)
  console.log(`  ${title}`)
  console.log(line)
}

function printSummaryHeader(title, ok) {
  const line = '─'.repeat(64)
  console.log(line)
  console.log(`  ${title}: ${ok ? color.green('УСПЕШНО') : color.red('ПРОВАЛ')}`)
}

function printSummaryFooter() {
  console.log('─'.repeat(64))
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    let output = ''
    let settled = false

    const finish = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    const child = spawn(command, args, {
      cwd: root,
      stdio: ['inherit', 'pipe', 'pipe'],
      ...options,
    })

    const forward = (stream) => (chunk) => {
      const text = chunk.toString()
      output += text
      stream.write(text)
    }

    child.stdout.on('data', forward(process.stdout))
    child.stderr.on('data', forward(process.stderr))

    child.on('error', (error) => {
      const message = `Не удалось запустить ${command}: ${error.message}\n`
      output += message
      process.stderr.write(message)
      finish({ code: 1, output })
    })

    child.on('close', (code, signal) => {
      finish({ code: code ?? (signal ? 1 : 0), output })
    })
  })
}

function parseMaven(output) {
  const matches = [
    ...stripAnsi(output).matchAll(
      /Tests run:\s*(\d+),\s*Failures:\s*(\d+),\s*Errors:\s*(\d+),\s*Skipped:\s*(\d+)/g,
    ),
  ]
  if (matches.length === 0) return null

  // The last match is the total printed after the "Results:" section.
  const [, tests, failures, errors, skipped] = matches.at(-1)
  const total = Number(tests)
  const failed = Number(failures) + Number(errors)
  const skippedCount = Number(skipped)

  return {
    total,
    passed: total - failed - skippedCount,
    failed,
    skipped: skippedCount,
    executed: total - skippedCount,
  }
}

function parseVitest(output) {
  const plain = stripAnsi(output)
  // Vitest prints a line like:
  //   Tests  2 passed | 1 failed (3)
  //   Tests  3 passed (3)
  //   Tests  1 skipped | 2 passed (3)
  const match = plain.match(/^[ \t]*Tests[ \t]+(.+?)[ \t]+\((\d+)\)[ \t]*$/m)
  if (!match) return null

  const [, details, totalText] = match
  const total = Number(totalText)
  const numberIn = (label) => {
    const found = details.match(new RegExp(`(\\d+)\\s+${label}\\b`))
    return found ? Number(found[1]) : 0
  }

  const failed = numberIn('failed')
  const skipped = numberIn('skipped') + numberIn('todo')
  const passed = details.includes('passed')
    ? numberIn('passed')
    : total - failed - skipped

  return {
    total,
    passed,
    failed,
    skipped,
    executed: total - skipped,
  }
}

function plural(count, one, few, many) {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function printTestStats(stats) {
  if (!stats) {
    console.log('  Тесты: не запускались или не удалось разобрать вывод')
    return
  }

  console.log(
    `  Тестов: ${stats.total} всего · ${stats.executed} запущено · ${stats.passed} успешно · ${
      stats.failed
    } ${plural(stats.failed, 'провал', 'провала', 'провалов')} · ${stats.skipped} пропущено`,
  )
}

function testsStatus(stats, stepOk) {
  if (stats) return stats.failed === 0 ? OK : FAIL
  return stepOk ? SKIP : FAIL
}

async function checkBackend() {
  printHeader('БЭКЕНД · spotless + компиляция + тесты')
  if (isGitHubActions) console.log('::group::Бэкенд')

  const result = await run('mise', ['run', 'be-check'])
  const stats = parseMaven(result.output)

  if (isGitHubActions) console.log('::endgroup::')

  const testsRan = stats !== null
  // Tests can only run after spotless and compilation succeeded; if they did
  // not run, the earlier stage is what failed.
  const buildOk = testsRan || result.code === 0
  const testsOk = testsRan && stats.failed === 0
  const ok = result.code === 0

  printSummaryHeader('СВОДКА БЭКЕНДА', ok)
  printTestStats(stats)
  console.log(
    `  Проверки: Spotless/компиляция ${buildOk ? OK : FAIL} · тесты ${
      testsRan ? (testsOk ? OK : FAIL) : SKIP
    }`,
  )
  printSummaryFooter()

  return {
    ok,
    stats,
    label: 'Бэкенд',
  }
}

async function runFrontendStep(steps, name, command, args, options) {
  console.log(color.dim(`\n▸ ${name}`))
  const result = await run(command, args, options)
  const step = { name, ...result, ok: result.code === 0 }
  steps.push(step)
  return step
}

async function checkFrontend() {
  printHeader('ФРОНТЕНД · линтер + vitest + сборка + HTTP-смоук')
  if (isGitHubActions) console.log('::group::Фронтенд')

  const steps = []
  const npm = (script) => [`--prefix`, 'FE', 'run', script]

  const lint = await runFrontendStep(steps, 'oxlint', 'npm', npm('lint'))
  // Run unit tests even if lint failed: they may reveal a different problem.
  const unit = await runFrontendStep(steps, 'vitest', 'npm', npm('test:unit'))
  const stats = parseVitest(unit.output)

  const build = await runFrontendStep(steps, 'сборка (tsc + vite build)', 'npm', npm('build'))

  let smoke
  if (build.ok) {
    smoke = await runFrontendStep(steps, 'HTTP-смоук', 'node', ['scripts/smoke.mjs'], { cwd: path.join(root, 'FE') })
  }

  if (isGitHubActions) console.log('::endgroup::')

  const smokeOk = smoke ? smoke.ok : null
  const ok = lint.ok && unit.ok && build.ok && smokeOk === true

  const stepStatus = (step) => (step ? (step.ok ? OK : FAIL) : SKIP)

  printSummaryHeader('СВОДКА ФРОНТЕНДА', ok)
  printTestStats(stats)
  console.log(
    `  Проверки: oxlint ${stepStatus(lint)} · vitest ${testsStatus(stats, unit.ok)} · сборка ${stepStatus(
      build,
    )} · HTTP-смоук ${smoke ? stepStatus(smoke) : `${SKIP} (не запускался)`}`,
  )
  printSummaryFooter()

  return {
    ok,
    stats,
    label: 'Фронтенд',
  }
}

function printFinalSummary(results) {
  printHeader('ИТОГ ПО ПРОЕКТУ')

  const header = ['Часть', 'Всего', 'Запущено', 'Успешно', 'Провалы', 'Пропущено', 'Статус']
  const rows = results.map(({ label, stats, ok }) => [
    label,
    stats ? String(stats.total) : '—',
    stats ? String(stats.executed) : '—',
    stats ? String(stats.passed) : '—',
    stats ? String(stats.failed) : '—',
    stats ? String(stats.skipped) : '—',
    ok ? OK : FAIL,
  ])

  if (results.length > 1) {
    const totals = results.reduce(
      (acc, { stats }) => {
        if (!stats) return acc
        acc.total += stats.total
        acc.executed += stats.executed
        acc.passed += stats.passed
        acc.failed += stats.failed
        acc.skipped += stats.skipped
        return acc
      },
      { total: 0, executed: 0, passed: 0, failed: 0, skipped: 0 },
    )
    rows.push([
      'Итого',
      String(totals.total),
      String(totals.executed),
      String(totals.passed),
      String(totals.failed),
      String(totals.skipped),
      results.every((result) => result.ok) ? OK : FAIL,
    ])
  }

  const allRows = [header, ...rows]
  const widths = header.map((_, index) =>
    Math.max(...allRows.map((row) => stripAnsi(row[index]).length)),
  )

  const formatRow = (row) =>
    row
      .map((cell, index) => {
        const visibleLength = stripAnsi(cell).length
        const padding = ' '.repeat(Math.max(0, widths[index] - visibleLength))
        // Right-align numeric columns, left-align text and status.
        return index === 0 || index === row.length - 1 ? `${cell}${padding}` : `${padding}${cell}`
      })
      .join('  ')

  console.log(`  ${formatRow(header)}`)
  console.log(`  ${widths.map((width) => '─'.repeat(width)).join('  ')}`)
  for (const row of rows) console.log(`  ${formatRow(row)}`)
  console.log('═'.repeat(64))
}

const results = []
if (mode === 'all' || mode === 'be') results.push(await checkBackend())
if (mode === 'all' || mode === 'fe') results.push(await checkFrontend())

printFinalSummary(results)

const failed = results.some((result) => !result.ok)
if (failed) {
  console.log(color.red('Проверка не пройдена.'))
  process.exitCode = 1
} else {
  console.log(color.green('Все проверки пройдены.'))
}
