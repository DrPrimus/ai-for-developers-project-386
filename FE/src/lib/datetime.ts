/**
 * Отображение дат и времени, приходящих с сервера.
 *
 * Модуль только форматирует ответ API: рабочие часы, окно и слоты считает сервер, а часовой пояс
 * берётся из поля `timeZone` ответа. Единственное локальное правило — визуальная пометка выходного
 * дня: контракт не отдаёт флаг выходного, но день недели однозначно следует из даты.
 */

const RU = 'ru-RU'

function asUtcDate(date: string) {
  return new Date(`${date}T00:00:00Z`)
}

/** Дата и день недели дня календаря: «вторник, 17 ноября». */
export function formatDayHeading(date: string) {
  return new Intl.DateTimeFormat(RU, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(asUtcDate(date))
}

/** Дата с годом для доступного имени слота: «вторник, 17 ноября 2026». */
export function formatDayWithYear(date: string) {
  return `${formatDayHeading(date)} ${date.slice(0, 4)}`
}

/** Время слота в часовом поясе сервиса: «09:30». */
export function formatTime(isoDateTime: string, timeZone: string) {
  return new Intl.DateTimeFormat(RU, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(new Date(isoDateTime))
}

/** Подпись слота на кнопке: «09:30–10:00». */
export function formatTimeRange(
  startsAt: string,
  endsAt: string,
  timeZone: string,
) {
  return `${formatTime(startsAt, timeZone)}–${formatTime(endsAt, timeZone)}`
}

/** Доступное имя кнопки слота: «вторник, 17 ноября 2026, 09:30–10:00». */
export function formatSlotLabel(
  date: string,
  startsAt: string,
  endsAt: string,
  timeZone: string,
) {
  return `${formatDayWithYear(date)}, ${formatTimeRange(startsAt, endsAt, timeZone)}`
}

/** Календарная дата момента в часовом поясе сервиса: «2026-11-17». */
export function instantDateKey(isoDateTime: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(new Date(isoDateTime))
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** Дата встречи из момента времени в часовом поясе сервиса: «вторник, 17 ноября 2026». */
export function formatInstantDay(isoDateTime: string, timeZone: string) {
  return formatDayWithYear(instantDateKey(isoDateTime, timeZone))
}

/** Суббота или воскресенье — только для пометки «Выходной» в интерфейсе. */
export function isWeekend(date: string) {
  const dayOfWeek = asUtcDate(date).getUTCDay()
  return dayOfWeek === 0 || dayOfWeek === 6
}
