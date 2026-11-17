import type { MeetingType } from '@/api/client'
import { Button } from '@/components/ui/button'

type LoadState = 'loading' | 'ready' | 'error'

type Props = {
  items: MeetingType[]
  state: LoadState
  onSelect: (meetingType: MeetingType) => void
  onRetry: () => void
}

/** Карточки типов встреч: название, описание и длительность, выбор одним нажатием. */
export function MeetingTypePicker({ items, state, onSelect, onRetry }: Props) {
  if (state === 'loading') {
    return <p className="text-sm text-muted-foreground">Загружаем типы встреч…</p>
  }

  if (state === 'error') {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">Не удалось загрузить типы встреч.</p>
        <Button type="button" variant="outline" onClick={onRetry}>
          Повторить
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Пока нет типов встреч.</p>
  }

  return (
    <ul aria-label="Типы встреч" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className="flex h-full w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left text-card-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{item.name}</span>
              <span className="shrink-0 text-sm text-muted-foreground">
                {item.durationMinutes} мин
              </span>
            </span>
            <span className="text-sm text-muted-foreground">{item.description}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
