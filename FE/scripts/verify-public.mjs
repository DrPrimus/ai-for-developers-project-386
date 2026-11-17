// Проверка развёрнутого экземпляра по публичному URL: проходит сценарий владельца
// и гостя в браузере, затем повторяет бронирование напрямую через API и ждёт 409
// с альтернативами. Локальные серверы не поднимает — только PUBLIC_URL.
//
// Запуск: PUBLIC_URL=https://<service>.onrender.com node FE/scripts/verify-public.mjs

import assert from 'node:assert/strict'

import { chromium, request } from '@playwright/test'

// Free-инстанс Render засыпает и поднимается около минуты, плюс loading page
// перед первым ответом приложения, поэтому таймауты щедрые.
const NAVIGATION_TIMEOUT_MS = 120_000
const STEP_TIMEOUT_MS = 120_000
const OPEN_ATTEMPTS = 3

const MEETING_TYPE = {
  // Уникальное имя: в хранилище уже могут быть типы от прошлых прогонов.
  name: `Проверка деплоя ${new Date().toISOString()}`,
  description: 'Тип встречи, созданный скриптом проверки публичного URL',
  durationMinutes: 30,
}

function requirePublicUrl() {
  const raw = process.env.PUBLIC_URL
  if (!raw) {
    throw new Error(
      'PUBLIC_URL не задан. Укажите базовый адрес развёрнутого сервиса, ' +
        'например: PUBLIC_URL=https://booking-386.onrender.com node FE/scripts/verify-public.mjs',
    )
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`PUBLIC_URL не является корректным URL: ${raw}`)
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      `PUBLIC_URL должен быть http(s)-адресом, получено: ${url.protocol}`,
    )
  }

  return url.href.replace(/\/+$/, '')
}

/**
 * Открывает путь и ждёт готовности приложения. Первый запрос к спящему
 * Render может вернуть loading page вместо SPA, поэтому повторяем переход.
 */
async function openPage(page, baseUrl, path, readyLocator, label) {
  let lastError
  for (let attempt = 1; attempt <= OPEN_ATTEMPTS; attempt += 1) {
    try {
      await page.goto(`${baseUrl}${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT_MS,
      })
      await readyLocator.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
      return
    } catch (error) {
      lastError = error
      console.error(
        `  ${label}: попытка ${attempt}/${OPEN_ATTEMPTS} не удалась — ${
          error instanceof Error ? error.message.split('\n')[0] : String(error)
        }`,
      )
      if (attempt < OPEN_ATTEMPTS) await page.waitForTimeout(2_000)
    }
  }
  throw new Error(
    `Не удалось открыть ${path} на ${baseUrl} за ${OPEN_ATTEMPTS} попытки: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  )
}

async function expectText(locator, expected, label) {
  await locator.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
  const text = await locator.textContent()
  assert.ok(
    text?.includes(expected),
    `${label}: ожидали текст «${expected}», получили «${text ?? ''}»`,
  )
  return text
}

async function main() {
  const baseUrl = requirePublicUrl()
  console.log(`Проверяем развёрнутый сервис: ${baseUrl}`)

  let browser
  let apiContext

  try {
    browser = await chromium.launch({ timeout: NAVIGATION_TIMEOUT_MS })
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(STEP_TIMEOUT_MS)
    page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS)

    // 1. Владелец создаёт тип встречи.
    await openPage(
      page,
      baseUrl,
      '/admin',
      page.getByRole('heading', { name: 'Админка' }),
      '/admin',
    )

    await page.getByLabel('Название', { exact: true }).fill(MEETING_TYPE.name)
    await page
      .getByLabel('Описание', { exact: true })
      .fill(MEETING_TYPE.description)
    await page
      .getByLabel('Длительность, минут', { exact: true })
      .fill(String(MEETING_TYPE.durationMinutes))
    await page.getByRole('button', { name: 'Создать тип встречи' }).click()

    await expectText(
      page.getByRole('status'),
      'Тип встречи создан.',
      'создание типа встречи',
    )

    const createdType = page
      .getByRole('list', { name: 'Типы встреч' })
      .getByRole('listitem')
      .filter({ hasText: MEETING_TYPE.name })
    await expectText(
      createdType,
      `${MEETING_TYPE.durationMinutes} мин`,
      'созданный тип встречи',
    )
    console.log(`  тип встречи создан: ${MEETING_TYPE.name}`)

    // 2. Гость выбирает этот тип и первый свободный слот.
    await page.goto(`${baseUrl}/booking`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    })

    const typeButton = page
      .getByRole('list', { name: 'Типы встреч' })
      .getByRole('listitem')
      .filter({ hasText: MEETING_TYPE.name })
      .getByRole('button')
    await expectText(
      typeButton,
      `${MEETING_TYPE.durationMinutes} мин`,
      'тип встречи у гостя',
    )
    await typeButton.click()

    const calendarDays = page
      .getByRole('list', { name: 'Календарь на 14 дней' })
      .getByRole('listitem')
    await calendarDays
      .first()
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })

    // Берём день минимум с двумя слотами: первый слот бронируется, а второй
    // гарантирует непустые альтернативы в ответе 409 на повторную бронь.
    let firstSlot
    const dayCount = await calendarDays.count()
    for (let index = 0; index < dayCount; index += 1) {
      const daySlots = calendarDays.nth(index).getByRole('button')
      if ((await daySlots.count()) >= 2) {
        firstSlot = daySlots.first()
        break
      }
    }
    assert.ok(
      firstSlot,
      `Не нашли день календаря с двумя и более слотами (дней: ${dayCount}); ` +
        'для проверки 409 нужен день, где после брони остаётся альтернатива',
    )
    await firstSlot.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })

    const slotLabel = await firstSlot.getAttribute('aria-label')
    assert.ok(slotLabel, 'У кнопки первого слота нет доступного имени')

    // Доступное имя: «вторник, 17 ноября 2026, 09:30–10:00».
    const labelParts = slotLabel.split(', ')
    const timeRange = labelParts.at(-1)
    assert.ok(timeRange, `Не разобрать подпись слота: ${slotLabel}`)
    const dayLabel = labelParts.slice(0, -1).join(', ')

    const bookingResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith('/api/meetings'),
      { timeout: STEP_TIMEOUT_MS },
    )
    await firstSlot.click()
    const bookingResponse = await bookingResponsePromise
    assert.equal(
      bookingResponse.status(),
      201,
      `Бронирование из интерфейса вернуло HTTP ${bookingResponse.status()}`,
    )
    const meeting = await bookingResponse.json()

    // 3. Проверяем подтверждение в интерфейсе и данные ответа.
    const confirmation = page.getByRole('status')
    await expectText(
      confirmation,
      `Встреча забронирована: ${MEETING_TYPE.name}`,
      'подтверждение брони',
    )
    await expectText(confirmation, dayLabel, 'дата в подтверждении')
    await expectText(confirmation, timeRange, 'время в подтверждении')
    await expectText(
      confirmation,
      `${MEETING_TYPE.durationMinutes} мин`,
      'длительность в подтверждении',
    )

    const meetingTypeId = meeting?.meetingType?.id
    const startsAt = meeting?.startsAt
    assert.ok(
      typeof meetingTypeId === 'string' && meetingTypeId.length > 0,
      'В ответе бронирования нет meetingType.id',
    )
    assert.ok(
      typeof startsAt === 'string' && startsAt.length > 0,
      'В ответе бронирования нет startsAt',
    )
    console.log(
      `  гость забронировал: ${dayLabel}, ${timeRange} (${meeting.id})`,
    )

    // 4. Владелец обновляет админку и видит встречу.
    await page.goto(`${baseUrl}/admin`, {
      waitUntil: 'domcontentloaded',
      timeout: NAVIGATION_TIMEOUT_MS,
    })
    await page
      .getByRole('heading', { name: 'Предстоящие встречи' })
      .waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    await page.getByRole('button', { name: 'Обновить' }).click()

    const meetingRow = page
      .getByRole('region', { name: dayLabel })
      .getByRole('listitem')
      .filter({ hasText: MEETING_TYPE.name })
    await meetingRow.waitFor({ state: 'visible', timeout: STEP_TIMEOUT_MS })
    assert.equal(
      await meetingRow.count(),
      1,
      `Владелец должен видеть ровно одну встречу «${MEETING_TYPE.name}»`,
    )
    await expectText(meetingRow, timeRange, 'время встречи у владельца')
    await expectText(
      meetingRow,
      `${MEETING_TYPE.durationMinutes} мин`,
      'длительность у владельца',
    )
    console.log(`  владелец видит встречу в предстоящих: ${dayLabel}, ${timeRange}`)

    // 5. Повторное бронирование того же слота напрямую через API — 409
    // с непустым списком альтернатив.
    apiContext = await request.newContext({
      baseURL: baseUrl,
      timeout: STEP_TIMEOUT_MS,
    })
    const conflictResponse = await apiContext.post('/api/meetings', {
      data: { meetingTypeId, startsAt },
    })
    assert.equal(
      conflictResponse.status(),
      409,
      `Повторная бронь того же слота должна вернуть 409, получено HTTP ${conflictResponse.status()}`,
    )

    const conflictBody = await conflictResponse.json()
    assert.equal(
      typeof conflictBody.code,
      'string',
      'В ответе 409 нет строкового code',
    )
    assert.ok(conflictBody.code.length > 0, 'В ответе 409 пустой code')
    assert.equal(
      typeof conflictBody.date,
      'string',
      'В ответе 409 нет date занятого дня',
    )
    assert.ok(conflictBody.date.length > 0, 'В ответе 409 пустой date')
    assert.ok(
      Array.isArray(conflictBody.slots),
      'В ответе 409 нет массива slots',
    )
    assert.ok(
      conflictBody.slots.length > 0,
      'В ответе 409 пустой список альтернативных слотов',
    )
    for (const [index, slot] of conflictBody.slots.entries()) {
      assert.ok(
        typeof slot?.startsAt === 'string' && slot.startsAt.length > 0,
        `Альтернатива ${index + 1} без startsAt`,
      )
      assert.ok(
        typeof slot?.endsAt === 'string' && slot.endsAt.length > 0,
        `Альтернатива ${index + 1} без endsAt`,
      )
    }

    console.log(
      `  повторная бронь через API: HTTP 409 ${conflictBody.code}, альтернатив на ${conflictBody.date}: ${conflictBody.slots.length}`,
    )

    console.log('')
    console.log(`PASS: публичный сценарий на ${baseUrl}`)
    console.log(`  тип встречи: ${MEETING_TYPE.name}`)
    console.log(`  бронь: ${dayLabel}, ${timeRange}, ${MEETING_TYPE.durationMinutes} мин`)
    console.log(
      `  повторная бронь: HTTP 409, альтернативы: ${conflictBody.slots.length} на ${conflictBody.date}`,
    )
  } finally {
    await apiContext?.dispose()
    await browser?.close()
  }
}

let exitCode = 0
try {
  await main()
} catch (error) {
  console.error(
    `FAIL: ${error instanceof Error ? error.message : String(error)}`,
  )
  exitCode = 1
}
process.exit(exitCode)
