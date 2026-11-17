import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, createMeeting, getSlots, listMeetingTypes } from '@/api/client'
import { AppRoutes } from '@/App'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listMeetingTypes: vi.fn(),
    getSlots: vi.fn(),
    createMeeting: vi.fn(),
  }
})

const listMock = vi.mocked(listMeetingTypes)
const slotsMock = vi.mocked(getSlots)
const bookMock = vi.mocked(createMeeting)

const CONSULTATION = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Консультация',
  description: 'Разбор задачи',
  durationMinutes: 30,
}

const REVIEW = {
  id: '22222222-2222-2222-2222-222222222222',
  name: 'Ревью кода',
  description: 'Проверка решения',
  durationMinutes: 60,
}

function slot(startsAt: string, endsAt: string) {
  return { startsAt, endsAt }
}

const SLOT_DAYS = [
  {
    date: '2026-11-17',
    slots: [
      slot('2026-11-17T09:30:00+03:00', '2026-11-17T10:00:00+03:00'),
      slot('2026-11-17T10:00:00+03:00', '2026-11-17T10:30:00+03:00'),
    ],
  },
  {
    date: '2026-11-18',
    slots: [slot('2026-11-18T09:00:00+03:00', '2026-11-18T09:30:00+03:00')],
  },
  { date: '2026-11-19', slots: [] },
  {
    date: '2026-11-20',
    slots: [slot('2026-11-20T09:00:00+03:00', '2026-11-20T09:30:00+03:00')],
  },
  { date: '2026-11-21', slots: [] },
  { date: '2026-11-22', slots: [] },
  {
    date: '2026-11-23',
    slots: [slot('2026-11-23T09:00:00+03:00', '2026-11-23T09:30:00+03:00')],
  },
  {
    date: '2026-11-24',
    slots: [slot('2026-11-24T09:00:00+03:00', '2026-11-24T09:30:00+03:00')],
  },
  {
    date: '2026-11-25',
    slots: [slot('2026-11-25T09:00:00+03:00', '2026-11-25T09:30:00+03:00')],
  },
  {
    date: '2026-11-26',
    slots: [slot('2026-11-26T09:00:00+03:00', '2026-11-26T09:30:00+03:00')],
  },
  {
    date: '2026-11-27',
    slots: [slot('2026-11-27T09:00:00+03:00', '2026-11-27T09:30:00+03:00')],
  },
  { date: '2026-11-28', slots: [] },
  { date: '2026-11-29', slots: [] },
  {
    date: '2026-11-30',
    slots: [slot('2026-11-30T09:00:00+03:00', '2026-11-30T09:30:00+03:00')],
  },
]

const SLOTS = {
  timeZone: 'Europe/Moscow',
  window: { from: '2026-11-17', to: '2026-11-30' },
  days: SLOT_DAYS,
}

function renderBooking() {
  return render(
    <MemoryRouter initialEntries={['/booking']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

async function selectConsultation(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', { name: /Консультация/ }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue([])
  slotsMock.mockResolvedValue(SLOTS)
})

const BOOKED = {
  id: '33333333-3333-3333-3333-333333333333',
  meetingType: {
    id: CONSULTATION.id,
    name: CONSULTATION.name,
    durationMinutes: CONSULTATION.durationMinutes,
  },
  startsAt: '2026-11-17T09:30:00+03:00',
  endsAt: '2026-11-17T10:00:00+03:00',
}

const SLOTS_AFTER_BOOKING = {
  ...SLOTS,
  days: SLOT_DAYS.map((day) =>
    day.date === '2026-11-17' ? { date: day.date, slots: [day.slots[1]] } : day,
  ),
}

const FIRST_SLOT = /вторник, 17 ноября 2026, 09:30–10:00/

describe('/booking: выбор типа встречи', () => {
  it('показывает загрузку, пока типы встреча не загрузились', () => {
    listMock.mockReturnValue(new Promise(() => {}))

    renderBooking()

    expect(screen.getByText(/загружаем типы встреч/i)).toBeInTheDocument()
  })

  it('показывает карточки с названием, описанием и длительностью', async () => {
    listMock.mockResolvedValue([CONSULTATION, REVIEW])

    renderBooking()

    const consultation = await screen.findByRole('button', { name: /Консультация/ })
    expect(within(consultation).getByText('Разбор задачи')).toBeInTheDocument()
    expect(within(consultation).getByText('30 мин')).toBeInTheDocument()

    const review = screen.getByRole('button', { name: /Ревью кода/ })
    expect(within(review).getByText('Проверка решения')).toBeInTheDocument()
    expect(within(review).getByText('60 мин')).toBeInTheDocument()
  })

  it('показывает пустое состояние, когда типов ещё нет', async () => {
    renderBooking()

    expect(
      await screen.findByText(/пока нет типов встреч/i),
    ).toBeInTheDocument()
  })

  it('показывает ошибку загрузки типов и повторяет запрос', async () => {
    const user = userEvent.setup()
    listMock
      .mockRejectedValueOnce(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Нет сети' }))
      .mockResolvedValueOnce([CONSULTATION])

    renderBooking()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /не удалось загрузить типы встреч/i,
    )

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByRole('button', { name: /Консультация/ }),
    ).toBeInTheDocument()
  })
})

describe('/booking: календарь слотов', () => {
  it('после выбора типа показывает все 14 дней с датой и днём недели', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([CONSULTATION])

    renderBooking()
    await selectConsultation(user)

    const calendar = await screen.findByRole('list', { name: /календарь на 14 дней/i })
    expect(within(calendar).getAllByRole('listitem')).toHaveLength(14)
    expect(within(calendar).getByText(/вторник, 17 ноября/i)).toBeInTheDocument()
    expect(within(calendar).getByText(/понедельник, 30 ноября/i)).toBeInTheDocument()
    expect(slotsMock).toHaveBeenCalledWith(CONSULTATION.id)
  })

  it('помечает выходные и будние дни без слотов по-разному', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([CONSULTATION])

    renderBooking()
    await selectConsultation(user)

    const calendar = await screen.findByRole('list', { name: /календарь на 14 дней/i })
    const weekend = within(calendar)
      .getAllByText('Выходной')
      .map((node) => node.closest('li'))
    expect(weekend).toHaveLength(4)
    expect(weekend[0]).toHaveTextContent(/суббота, 21 ноября/i)

    const emptyWeekday = within(calendar).getByText('Нет свободных слотов').closest('li')
    expect(emptyWeekday).toHaveTextContent(/четверг, 19 ноября/i)
  })

  it('рисует слот кнопкой с точным временем и доступным именем с датой', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([CONSULTATION])

    renderBooking()
    await selectConsultation(user)

    const button = await screen.findByRole('button', {
      name: /вторник, 17 ноября 2026, 09:30–10:00/i,
    })
    expect(button).toHaveTextContent('09:30–10:00')
  })

  it('показывает загрузку слотов после выбора типа', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([CONSULTATION])
    slotsMock.mockReturnValue(new Promise(() => {}))

    renderBooking()
    await selectConsultation(user)

    expect(await screen.findByText(/загружаем слоты/i)).toBeInTheDocument()
  })

  it('показывает ошибку загрузки слотов и повторяет запрос', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([CONSULTATION])
    slotsMock
      .mockRejectedValueOnce(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Нет сети' }))
      .mockResolvedValueOnce(SLOTS)

    renderBooking()
    await selectConsultation(user)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /не удалось загрузить слоты/i,
    )

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(
      await screen.findByRole('list', { name: /календарь на 14 дней/i }),
    ).toBeInTheDocument()
  })

  it('позволяет вернуться к выбору другого типа', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValue([CONSULTATION, REVIEW])

    renderBooking()
    await selectConsultation(user)
    await screen.findByRole('list', { name: /календарь на 14 дней/i })

    await user.click(screen.getByRole('button', { name: /выбрать другой тип/i }))

    expect(
      await screen.findByRole('button', { name: /Ревью кода/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('list', { name: /календарь на 14 дней/i }),
    ).not.toBeInTheDocument()
  })
})

describe('/booking: бронирование слота', () => {
  async function openCalendar(user: ReturnType<typeof userEvent.setup>) {
    listMock.mockResolvedValue([CONSULTATION, REVIEW])
    renderBooking()
    await selectConsultation(user)
    return screen.findByRole('button', { name: FIRST_SLOT })
  }

  it('бронирует слот одним нажатием и показывает подтверждение с деталями', async () => {
    const user = userEvent.setup()
    bookMock.mockResolvedValue(BOOKED)
    slotsMock.mockResolvedValueOnce(SLOTS).mockResolvedValueOnce(SLOTS_AFTER_BOOKING)

    const slotButton = await openCalendar(user)
    await user.click(slotButton)

    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent(/встреча забронирована/i)
    expect(status).toHaveTextContent('Консультация')
    expect(status).toHaveTextContent('вторник, 17 ноября 2026')
    expect(status).toHaveTextContent('09:30–10:00')
    expect(status).toHaveTextContent('30 мин')
    expect(bookMock).toHaveBeenCalledExactlyOnceWith({
      meetingTypeId: CONSULTATION.id,
      startsAt: '2026-11-17T09:30:00+03:00',
    })

    expect(
      await screen.findByRole('list', { name: /календарь на 14 дней/i }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: FIRST_SLOT }),
      ).not.toBeInTheDocument(),
    )
  })

  it('из подтверждения возвращает к выбору другого типа', async () => {
    const user = userEvent.setup()
    bookMock.mockResolvedValue(BOOKED)

    const slotButton = await openCalendar(user)
    await user.click(slotButton)

    const status = await screen.findByRole('status')
    await user.click(
      within(status).getByRole('button', { name: 'Выбрать другой тип' }),
    )

    expect(await screen.findByRole('button', { name: /Ревью кода/ })).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('блокирует кнопки слотов, пока запрос выполняется', async () => {
    const user = userEvent.setup()
    bookMock.mockReturnValue(new Promise(() => {}))

    const slotButton = await openCalendar(user)
    await user.click(slotButton)

    await waitFor(() => expect(slotButton).toBeDisabled())
    expect(bookMock).toHaveBeenCalledTimes(1)
  })

  it('показывает альтернативы, когда слот только что заняли', async () => {
    const user = userEvent.setup()
    const alternative = slot('2026-11-17T10:00:00+03:00', '2026-11-17T10:30:00+03:00')
    bookMock
      .mockRejectedValueOnce(
        new ApiError(409, {
          code: 'SLOT_TAKEN',
          message: 'Слот уже занят',
          date: '2026-11-17',
          slots: [alternative],
        }),
      )
      .mockResolvedValueOnce({ ...BOOKED, ...alternative })

    const slotButton = await openCalendar(user)
    await user.click(slotButton)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Слот только что заняли')
    expect(alert).toHaveTextContent('вторник, 17 ноября 2026')

    const replacement = within(alert).getByRole('button', {
      name: /вторник, 17 ноября 2026, 10:00–10:30/,
    })
    await waitFor(() => expect(slotsMock).toHaveBeenCalledTimes(2))

    await user.click(replacement)

    expect(bookMock).toHaveBeenLastCalledWith({
      meetingTypeId: CONSULTATION.id,
      startsAt: alternative.startsAt,
    })
    expect(await screen.findByRole('status')).toHaveTextContent('10:00–10:30')
  })

  it('показывает ошибку запроса и оставляет календарь доступным', async () => {
    const user = userEvent.setup()
    bookMock.mockRejectedValue(
      new ApiError(0, { code: 'NETWORK_ERROR', message: 'Нет сети' }),
    )

    const slotButton = await openCalendar(user)
    await user.click(slotButton)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/не удалось забронировать слот/i)
    expect(slotButton).toBeEnabled()
    expect(slotsMock).toHaveBeenCalledTimes(1)
  })
})
