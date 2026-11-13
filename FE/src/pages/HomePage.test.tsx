import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '@/App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  )
}

describe('главная страница', () => {
  it('рассказывает о сервисе и перечисляет возможности', () => {
    renderAt('/')

    expect(
      screen.getByRole('heading', { level: 1, name: 'Календарь звонков' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/забронируйте свободный слот на ближайшие две недели/i),
    ).toBeInTheDocument()

    const features = screen.getByRole('list', { name: 'Возможности' })
    expect(within(features).getAllByRole('listitem')).toHaveLength(3)
    expect(
      within(features).getByText('Выбор типа встречи и удобного времени'),
    ).toBeInTheDocument()
    expect(
      within(features).getByText('Мгновенное бронирование'),
    ).toBeInTheDocument()
    expect(
      within(features).getByText(
        'Управление типами встреч и просмотр предстоящих встреч в админке',
      ),
    ).toBeInTheDocument()
  })

  it('ведёт гостя на страницу записи', async () => {
    const user = userEvent.setup()
    renderAt('/')

    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: 'Записаться' })).toHaveAttribute(
      'href',
      '/booking',
    )

    await user.click(
      within(screen.getByRole('navigation', { name: 'Основная навигация' })).getByRole(
        'link',
        { name: 'Записаться' },
      ),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Запись на встречу' }),
    ).toBeInTheDocument()
  })

  it('ведёт владельца в админку', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(
      within(screen.getByRole('navigation', { name: 'Основная навигация' })).getByRole(
        'link',
        { name: 'Админка' },
      ),
    )

    expect(
      screen.getByRole('heading', { level: 1, name: 'Админка' }),
    ).toBeInTheDocument()
  })
})
