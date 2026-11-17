import type { MeetingType } from '@/api/client'

/** Общий тип встречи компонентных тестов: один и тот же на всех страницах. */
export const CONSULTATION: MeetingType = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Консультация',
  description: 'Разбор задачи',
  durationMinutes: 30,
}
