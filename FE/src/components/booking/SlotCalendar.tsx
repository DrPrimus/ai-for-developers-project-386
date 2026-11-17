import type { Slot, SlotListResponse } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  formatDayHeading,
  formatDayWithYear,
  formatTimeRange,
  isWeekend,
} from '@/lib/datetime'

type Props = {
  data: SlotListResponse
  /** Шов бронирования (#13): пока слот только выбирается, встреча не создаётся. */
  onSelectSlot: (slot: Slot) => void
}

/** Вертикальный календарь на всё окно: день, подпись выходного/пустого дня и слоты-кнопки. */
export function SlotCalendar({ data, onSelectSlot }: Props) {
  return (
    <section className="flex flex-col gap-3">
      <h2 id="booking-calendar-heading" className="font-heading text-lg font-semibold">
        Календарь на 14 дней
      </h2>
      <ol
        aria-label="Календарь на 14 дней"
        aria-labelledby="booking-calendar-heading"
        className="flex flex-col gap-3"
      >
        {data.days.map((day) => (
          <li key={day.date} className="rounded-xl border bg-background p-4">
            <h3 className="font-medium">{formatDayHeading(day.date)}</h3>

            {day.slots.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {isWeekend(day.date) ? 'Выходной' : 'Нет свободных слотов'}
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {day.slots.map((slot) => {
                  const range = formatTimeRange(slot.startsAt, slot.endsAt, data.timeZone)
                  return (
                    <Button
                      key={slot.startsAt}
                      type="button"
                      variant="outline"
                      aria-label={`${formatDayWithYear(day.date)}, ${range}`}
                      onClick={() => onSelectSlot(slot)}
                    >
                      {range}
                    </Button>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
