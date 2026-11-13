import { Check } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'

const FEATURES = [
  'Выбор типа встречи и удобного времени',
  'Мгновенное бронирование',
  'Управление типами встреч и просмотр предстоящих встреч в админке',
]

export function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 py-16">
      <section className="flex flex-col items-center gap-6 text-center">
        <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
          Календарь звонков
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Выберите тип встречи и забронируйте свободный слот на ближайшие две
          недели.
        </p>
        <Button asChild size="lg">
          <Link to="/booking">Записаться</Link>
        </Button>
      </section>

      <section className="flex flex-col gap-6">
        <h2
          id="features-heading"
          className="font-heading text-2xl font-semibold tracking-tight"
        >
          Возможности
        </h2>
        <ul
          aria-labelledby="features-heading"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {FEATURES.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-3 rounded-xl border bg-card p-4 text-card-foreground"
            >
              <Check
                className="mt-0.5 size-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
