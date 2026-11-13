import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

export function SiteHeader() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <Link
          to="/"
          className="flex items-center gap-2 font-heading text-lg font-semibold"
        >
          <CalendarDays className="size-5" aria-hidden="true" />
          Календарь звонков
        </Link>
        <nav
          aria-label="Основная навигация"
          className="flex items-center gap-2"
        >
          <Button asChild variant="ghost">
            <Link to="/admin">Админка</Link>
          </Button>
          <Button asChild>
            <Link to="/booking">Записаться</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
