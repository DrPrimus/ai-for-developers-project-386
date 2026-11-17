import { expect, test } from '@playwright/test'

// Счастливый путь на настоящих серверах: тип встречи создаёт владелец, слот
// выбирает гость. Часы настоящие, поэтому дата не фиксируется: тест берёт
// первый доступный слот из интерфейса.
const MEETING_TYPE = {
  name: 'Консультация',
  description: 'Короткий созвон, чтобы обсудить задачу',
  durationMinutes: 30,
}

test('гость бронирует слот созданного типа, владелец видит встречу', async ({
  page,
}) => {
  // День и время выбранного слота: подтверждение брони и список владельца
  // должны показать именно их.
  let dayLabel = ''
  let timeRange = ''

  await test.step('владелец создаёт тип встречи на /admin', async () => {
    await page.goto('/admin')

    await page.getByLabel('Название', { exact: true }).fill(MEETING_TYPE.name)
    await page
      .getByLabel('Описание', { exact: true })
      .fill(MEETING_TYPE.description)
    await page
      .getByLabel('Длительность, минут', { exact: true })
      .fill(String(MEETING_TYPE.durationMinutes))
    await page.getByRole('button', { name: 'Создать тип встречи' }).click()

    await expect(page.getByRole('status')).toHaveText('Тип встречи создан.')

    const createdTypes = page.getByRole('list', { name: 'Типы встреч' })
    await expect(
      createdTypes.getByRole('listitem').filter({ hasText: MEETING_TYPE.name }),
    ).toContainText(`${MEETING_TYPE.durationMinutes} мин`)
  })

  await test.step('гость выбирает тип и первый свободный слот', async () => {
    await page.goto('/booking')

    const typeButton = page
      .getByRole('list', { name: 'Типы встреч' })
      .getByRole('button', { name: new RegExp(MEETING_TYPE.name) })
    await expect(typeButton).toContainText(
      `${MEETING_TYPE.durationMinutes} мин`,
    )
    await typeButton.click()

    const calendar = page.getByRole('list', { name: 'Календарь на 14 дней' })
    const firstSlot = calendar.getByRole('button').first()
    await expect(firstSlot).toBeVisible()

    // Доступное имя кнопки: «вторник, 17 ноября 2026, 09:30–10:00».
    const slotLabel = await firstSlot.getAttribute('aria-label')
    if (!slotLabel) throw new Error('У кнопки слота нет доступного имени')

    const labelParts = slotLabel.split(', ')
    const lastPart = labelParts.at(-1)
    if (!lastPart) throw new Error(`Не разобрать подпись слота: ${slotLabel}`)
    timeRange = lastPart
    dayLabel = labelParts.slice(0, -1).join(', ')

    await firstSlot.click()

    const confirmation = page.getByRole('status')
    await expect(confirmation).toContainText(
      `Встреча забронирована: ${MEETING_TYPE.name}`,
    )
    await expect(confirmation).toContainText(dayLabel)
    await expect(confirmation).toContainText(timeRange)
    await expect(confirmation).toContainText(
      `${MEETING_TYPE.durationMinutes} мин`,
    )
  })

  await test.step('владелец видит встречу в предстоящих', async () => {
    await page.goto('/admin')
    await expect(
      page.getByRole('heading', { name: 'Предстоящие встречи' }),
    ).toBeVisible()

    // Явное обновление делает проверку детерминированной, не дожидаясь опроса.
    await page.getByRole('button', { name: 'Обновить' }).click()

    const daySection = page.getByRole('region', { name: dayLabel })
    const meetingRow = daySection
      .getByRole('listitem')
      .filter({ hasText: MEETING_TYPE.name })
    await expect(meetingRow).toHaveCount(1)
    await expect(meetingRow).toContainText(timeRange)
    await expect(meetingRow).toContainText(
      `${MEETING_TYPE.durationMinutes} мин`,
    )
  })
})
