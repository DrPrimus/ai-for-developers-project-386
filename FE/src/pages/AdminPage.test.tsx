import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMeetingType, listMeetingTypes, ApiError } from '@/api/client'
import { AppRoutes } from '@/App'

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/client')>()
  return {
    ...actual,
    listMeetingTypes: vi.fn(),
    createMeetingType: vi.fn(),
  }
})

const listMock = vi.mocked(listMeetingTypes)
const createMock = vi.mocked(createMeetingType)

const CONSULTATION = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Консультация',
  description: 'Разбор задачи',
  durationMinutes: 30,
}

function renderAdmin() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  values = { name: 'Консультация', description: 'Разбор задачи', duration: '30' },
) {
  await user.type(screen.getByLabelText('Название'), values.name)
  await user.type(screen.getByLabelText('Описание'), values.description)
  await user.type(screen.getByLabelText(/Длительность/), values.duration)
  await user.click(screen.getByRole('button', { name: 'Создать тип встречи' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  listMock.mockResolvedValue([])
})

describe('админка: типы встреч', () => {
  it('показывает созданные типы встреч', async () => {
    listMock.mockResolvedValue([CONSULTATION])

    renderAdmin()

    expect(await screen.findByText('Консультация')).toBeInTheDocument()
    expect(screen.getByText('Разбор задачи')).toBeInTheDocument()
    expect(screen.getByText('30 мин')).toBeInTheDocument()
  })

  it('показывает пустое состояние, когда типов ещё нет', async () => {
    renderAdmin()

    expect(await screen.findByText(/пока нет типов встреч/i)).toBeInTheDocument()
  })

  it('показывает ошибку загрузки и повторяет запрос', async () => {
    const user = userEvent.setup()
    listMock
      .mockRejectedValueOnce(new ApiError(0, { code: 'NETWORK_ERROR', message: 'Нет сети' }))
      .mockResolvedValueOnce([CONSULTATION])

    renderAdmin()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/не удалось загрузить типы встреч/i)

    await user.click(screen.getByRole('button', { name: 'Повторить' }))

    expect(await screen.findByText('Консультация')).toBeInTheDocument()
  })

  it('подсказывает допустимую длительность и кратность пяти', async () => {
    renderAdmin()

    const duration = screen.getByLabelText(/Длительность/)
    expect(duration).toHaveAttribute('type', 'number')
    expect(duration).toHaveAttribute('min', '5')
    expect(duration).toHaveAttribute('max', '480')
    expect(screen.getByText(/от 5 до 480 минут, кратно 5/i)).toBeInTheDocument()
  })

  it('создаёт тип встречи, очищает форму и обновляет список', async () => {
    const user = userEvent.setup()
    listMock.mockResolvedValueOnce([]).mockResolvedValueOnce([CONSULTATION])
    createMock.mockResolvedValue(CONSULTATION)

    renderAdmin()
    await screen.findByText(/пока нет типов встреч/i)

    await fillForm(user)

    await waitFor(() =>
      expect(createMock).toHaveBeenCalledWith({
        name: 'Консультация',
        description: 'Разбор задачи',
        durationMinutes: 30,
      }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(/тип встречи создан/i)
    expect(await screen.findByText('Консультация')).toBeInTheDocument()
    expect(screen.getByLabelText('Название')).toHaveValue('')
    expect(screen.getByLabelText('Описание')).toHaveValue('')
    expect(screen.getByLabelText(/Длительность/)).toHaveValue(null)
  })

  it('показывает ошибки полей из ответа API и сохраняет введённые значения', async () => {
    const user = userEvent.setup()
    createMock.mockRejectedValue(
      new ApiError(400, {
        code: 'VALIDATION_FAILED',
        message: 'Проверьте заполнение полей',
        fieldErrors: [
          { field: 'name', message: 'Укажите название' },
          { field: 'durationMinutes', message: 'Длительность должна быть кратна 5 минутам' },
        ],
      }),
    )

    renderAdmin()

    await fillForm(user, { name: 'Лекция', description: 'Про TDD', duration: '7' })

    expect(await screen.findByText('Укажите название')).toBeInTheDocument()
    expect(
      screen.getByText('Длительность должна быть кратна 5 минутам'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Название')).toHaveValue('Лекция')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
