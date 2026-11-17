import type { Slot, SlotListResponse } from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  formatDayHeading,
  formatSlotLabel,
  formatTimeRange,
  isWeekend,
} from '@/lib/datetime'

type Props = {
  data: SlotListResponse
  /** Нажатие бронирует слот: отдельного подтверждения нет. */
  onSelectSlot: (slot: Slot) => void
  /** Пока запрос бронирования выполняется, кнопки слотов заблокированы. */
  disabled?: boolean
}

/** Вертикальный календарь на всё окно: день, подпись выходного/пустого дня и слоты-кнопки. */
export function SlotCalendar({ data, onSelectSlot, disabled = false }: Props) {
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
                      disabled={disabled}
                      aria-label={formatSlotLabel(
                        day.date,
                        slot.startsAt,
                        slot.endsAt,
                        data.timeZone,
                      )}
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
