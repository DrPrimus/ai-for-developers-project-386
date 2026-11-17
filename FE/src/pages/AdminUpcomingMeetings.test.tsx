import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ApiError,
  listMeetingTypes,
  listUpcomingMeetings,
  type Meeting,
} from '@/api/client'
import { AppRoutes } from '@/App'
import { formatInstantDay } from '@/lib/datetime'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listMeetingTypes: vi.fn(),
    createMeetingType: vi.fn(),
    listUpcomingMeetings: vi.fn(),
  }
})

const listTypesMock = vi.mocked(listMeetingTypes)
const upcomingMock = vi.mocked(listUpcomingMeetings)

const TIME_ZONE = 'Europe/Moscow'

const CONSULTATION = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Консультация',
  description: 'Разбор задачи',
  durationMinutes: 30,
}

function meeting(id: string, startsAt: string, endsAt: string, name = 'Консультация', durationMinutes = 30): Meeting {
  return {
    id,
    meetingType: { id: CONSULTATION.id, name, durationMinutes },
    startsAt,
    endsAt,
  }
}

const WEDNESDAY_LATE = meeting(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '2026-11-18T10:00:00+03:00',
  '2026-11-18T10:30:00+03:00',
)
const WEDNESDAY_EARLY = meeting(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  '2026-11-18T09:00:00+03:00',
  '2026-11-18T09:30:00+03:00',
)
const THURSDAY = meeting(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  '2026-11-19T14:00:00+03:00',
  '2026-11-19T14:45:00+03:00',
  'Ревью кода',
  45,
)

const WINDOW = { from: '2026-11-17', to: '2026-11-30' }

function upcoming(items: Meeting[] = []) {
  return { timeZone: TIME_ZONE, window: WINDOW, items }
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

function upcomingCard() {
  const heading = screen.getByRole('heading', { name: 'Предстоящие встречи' })
  return heading.closest('[data-slot="card"]') as HTMLElement
}

function dayRegion(startsAt: string) {
  return screen.getByRole('region', {
    name: formatInstantDay(startsAt, TIME_ZONE),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  listTypesMock.mockResolvedValue([])
  upcomingMock.mockResolvedValue(upcoming())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('админка: предстоящие встречи', () => {
  it('группирует встречи по дням и сортирует по времени', async () => {
    upcomingMock.mockResolvedValue(
      upcoming([WEDNESDAY_LATE, THURSDAY, WEDNESDAY_EARLY]),
    )

    renderAdmin()

    await screen.findByRole('region', {
      name: formatInstantDay(WEDNESDAY_EARLY.startsAt, TIME_ZONE),
    })

    const headings = within(upcomingCard())
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent)
    expect(headings).toEqual([
      formatInstantDay(WEDNESDAY_EARLY.startsAt, TIME_ZONE),
      formatInstantDay(THURSDAY.startsAt, TIME_ZONE),
    ])

    const wednesdayRows = within(dayRegion(WEDNESDAY_EARLY.startsAt)).getAllByRole(
      'listitem',
    )
    expect(wednesdayRows).toHaveLength(2)
    expect(wednesdayRows[0]).toHaveTextContent('09:00–09:30')
    expect(wednesdayRows[0]).toHaveTextContent('Консультация')
    expect(wednesdayRows[0]).toHaveTextContent('30 мин')
    expect(wednesdayRows[1]).toHaveTextContent('10:00–10:30')

    const thursdayRows = within(dayRegion(THURSDAY.startsAt)).getAllByRole('listitem')
    expect(thursdayRows).toHaveLength(1)
    expect(thursdayRows[0]).toHaveTextContent('Ревью кода')
    expect(thursdayRows[0]).toHaveTextContent('14:00–14:45')
    expect(thursdayRows[0]).toHaveTextContent('45 мин')
  })

  it('показывает пустое состояние, отличное от ошибки', async () => {
    renderAdmin()

    expect(
      await screen.findByText(/пока нет предстоящих встреч/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/не удалось загрузить предстоящие/i)).not.toBeInTheDocument()
  })

  it('показывает ошибку загрузки и повторяет запрос', async () => {
    const user = userEvent.setup()
    upcomingMock
      .mockRejectedValueOnce(
        new ApiError(0, { code: 'NETWORK_ERROR', message: 'Нет сети' }),
      )
      .mockResolvedValue(upcoming([WEDNESDAY_EARLY]))

    renderAdmin()

    expect(await screen.findByText(/не удалось загрузить предстоящие/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText(/09:00–09:30/)).toBeInTheDocument()
    expect(screen.queryByText(/не удалось загрузить предстоящие/i)).not.toBeInTheDocument()
  })

  it('обновляет список по кнопке «Обновить»', async () => {
    const user = userEvent.setup()
    upcomingMock
      .mockResolvedValueOnce(upcoming([]))
      .mockResolvedValue(upcoming([WEDNESDAY_EARLY]))

    renderAdmin()

    await screen.findByText(/пока нет предстоящих встреч/i)

    await user.click(screen.getByRole('button', { name: 'Обновить' }))

    expect(await screen.findByText(/09:00–09:30/)).toBeInTheDocument()
    expect(screen.queryByText(/пока нет предстоящих встреч/i)).not.toBeInTheDocument()
  })

  it('перезапрашивает список каждые 10 секунд, пока вкладка видима', async () => {
    vi.useFakeTimers()
    upcomingMock.mockResolvedValue(upcoming([]))

    renderAdmin()

    await act(async () => {})
    expect(upcomingMock).toHaveBeenCalledTimes(1)

    upcomingMock.mockResolvedValue(upcoming([WEDNESDAY_EARLY]))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(upcomingMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/09:00–09:30/)).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(upcomingMock).toHaveBeenCalledTimes(3)
  })

  it('не опрашивает сервер, пока вкладка скрыта', async () => {
    vi.useFakeTimers()
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden')

    renderAdmin()
    await act(async () => {})
    expect(upcomingMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(upcomingMock).toHaveBeenCalledTimes(1)

    visibility.mockReturnValue('visible')
    upcomingMock.mockResolvedValue(upcoming([WEDNESDAY_EARLY]))
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(upcomingMock).toHaveBeenCalledTimes(2)
    expect(screen.getByText(/09:00–09:30/)).toBeInTheDocument()
  })

  it('перезапрашивает список при возврате фокуса на окно', async () => {
    upcomingMock
      .mockResolvedValueOnce(upcoming([]))
      .mockResolvedValue(upcoming([WEDNESDAY_EARLY]))

    renderAdmin()
    await screen.findByText(/пока нет предстоящих встреч/i)
    expect(upcomingMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.focus(window)
    })

    await waitFor(() => expect(upcomingMock).toHaveBeenCalledTimes(2))
    expect(await screen.findByText(/09:00–09:30/)).toBeInTheDocument()
  })
})
