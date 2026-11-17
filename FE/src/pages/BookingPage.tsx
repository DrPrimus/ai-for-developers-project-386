import { useEffect, useRef, useState } from 'react'

import {
  ApiError,
  createMeeting,
  getSlots,
  listMeetingTypes,
  type Meeting,
  type MeetingType,
  type Slot,
  type SlotListResponse,
} from '@/api/client'
import { LoadStateNotice, type LoadState } from '@/components/LoadStateNotice'
import { MeetingTypePicker } from '@/components/booking/MeetingTypePicker'
import { SlotCalendar } from '@/components/booking/SlotCalendar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  formatDayWithYear,
  formatInstantDay,
  formatSlotLabel,
  formatTimeRange,
} from '@/lib/datetime'

type TypesState = { state: LoadState; items: MeetingType[] }

type SlotsState = {
  state: 'idle' | LoadState
  data: SlotListResponse | null
  /** Обновление в фоне: календарь остаётся на экране, чтобы не терять фокус. */
  refreshing: boolean
}

/** Альтернативы занятого слота: день и свободные слоты, пришедшие в `409`. */
type SlotAlternatives = { date: string; slots: Slot[] }

/** Состояние бронирования: одна попытка за раз, после ответа — уведомление. */
type BookingState =
  | { state: 'idle' }
  | { state: 'submitting'; alternative: SlotAlternatives | null }
  | { state: 'success'; meeting: Meeting }
  | { state: 'conflict'; conflict: SlotAlternatives }
  | { state: 'error' }

export function BookingPage() {
  const [types, setTypes] = useState<TypesState>({ state: 'loading', items: [] })
  const [typesReload, setTypesReload] = useState(0)
  const [selected, setSelected] = useState<MeetingType | null>(null)
  const [slots, setSlots] = useState<SlotsState>({
    state: 'idle',
    data: null,
    refreshing: false,
  })
  const [slotsReload, setSlotsReload] = useState(0)
  const [timeZone, setTimeZone] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingState>({ state: 'idle' })
  const notificationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    listMeetingTypes()
      .then((items) => {
        if (active) setTypes({ state: 'ready', items })
      })
      .catch(() => {
        if (active) setTypes({ state: 'error', items: [] })
      })
    return () => {
      active = false
    }
  }, [typesReload])

  useEffect(() => {
    if (!selected) return
    let active = true
    getSlots(selected.id)
      .then((data) => {
        if (!active) return
        setTimeZone(data.timeZone)
        setSlots({ state: 'ready', data, refreshing: false })
      })
      .catch(() => {
        if (active) setSlots({ state: 'error', data: null, refreshing: false })
      })
    return () => {
      active = false
    }
  }, [selected, slotsReload])

  /** Уведомление после ответа сервера получает фокус: бронь не должна сбрасывать его на body. */
  useEffect(() => {
    const notificationVisible =
      booking.state === 'success' ||
      booking.state === 'conflict' ||
      (booking.state === 'submitting' && booking.alternative !== null)
    if (notificationVisible) notificationRef.current?.focus()
  }, [booking])

  function retryTypes() {
    setTypes({ state: 'loading', items: [] })
    setTypesReload((token) => token + 1)
  }

  function selectType(meetingType: MeetingType) {
    setSelected(meetingType)
    setBooking({ state: 'idle' })
    setSlots({ state: 'loading', data: null, refreshing: false })
  }

  function retrySlots() {
    setSlots({ state: 'loading', data: null, refreshing: false })
    setSlotsReload((token) => token + 1)
  }

  function backToTypes() {
    setSelected(null)
    setBooking({ state: 'idle' })
    setSlots({ state: 'idle', data: null, refreshing: false })
  }

  /**
   * Перезапрашивает календарь в фоне: после брони или пересечения слоты устарели, но календарь
   * остаётся смонтированным, иначе фокус и прокрутка теряются.
   */
  function refreshSlots() {
    setSlots((current) => ({ ...current, refreshing: true }))
    setSlotsReload((token) => token + 1)
  }

  /** Нажатие на слот сразу создаёт встречу; отдельного подтверждения нет. */
  function bookSlot(slot: Slot) {
    if (!selected || booking.state === 'submitting') return

    setBooking({
      state: 'submitting',
      alternative: booking.state === 'conflict' ? booking.conflict : null,
    })
    createMeeting({ meetingTypeId: selected.id, startsAt: slot.startsAt })
      .then((meeting) => {
        setBooking({ state: 'success', meeting })
        refreshSlots()
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 409) {
          setBooking({
            state: 'conflict',
            conflict: {
              date: error.date ?? slot.startsAt.slice(0, 10),
              slots: error.slots,
            },
          })
          refreshSlots()
        } else {
          setBooking({ state: 'error' })
        }
      })
  }

  const submitting = booking.state === 'submitting'
  const conflict =
    booking.state === 'conflict'
      ? booking.conflict
      : booking.state === 'submitting'
        ? booking.alternative
        : null
  const calendarVisible =
    slots.data !== null && (slots.state === 'ready' || slots.refreshing)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Запись на встречу
        </h1>
        <p className="text-muted-foreground">
          Выберите тип встречи — календарь покажет свободные слоты на ближайшие
          две недели.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="font-heading text-xl font-semibold">
              {selected ? selected.name : 'Тип встречи'}
            </h2>
          </CardTitle>
          <CardDescription>
            {selected
              ? `${selected.description} · ${selected.durationMinutes} мин`
              : 'Название, описание и длительность подскажут, что именно вы бронируете.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {!selected && (
            <MeetingTypePicker
              items={types.items}
              state={types.state}
              onSelect={selectType}
              onRetry={retryTypes}
            />
          )}

          {selected && (
            <>
              <Button
                type="button"
                variant="ghost"
                className="self-start"
                disabled={submitting}
                onClick={backToTypes}
              >
                ← Выбрать другой тип
              </Button>

              {booking.state === 'success' && timeZone && (
                <div
                  ref={notificationRef}
                  role="status"
                  tabIndex={-1}
                  className="flex flex-col items-start gap-3 rounded-xl border bg-accent/40 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <p className="text-sm">
                    Встреча забронирована: {booking.meeting.meetingType.name},{' '}
                    {formatInstantDay(booking.meeting.startsAt, timeZone)},{' '}
                    {formatTimeRange(
                      booking.meeting.startsAt,
                      booking.meeting.endsAt,
                      timeZone,
                    )}
                    , {booking.meeting.meetingType.durationMinutes} мин
                  </p>
                  <Button type="button" variant="outline" onClick={backToTypes}>
                    Выбрать другой тип
                  </Button>
                </div>
              )}

              {conflict && timeZone && (
                <div
                  ref={notificationRef}
                  role="alert"
                  tabIndex={-1}
                  className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <p className="text-sm">
                    Слот только что заняли. Выберите другое время на{' '}
                    {formatDayWithYear(conflict.date)}.
                  </p>
                  {conflict.slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      На этот день свободных слотов не осталось.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {conflict.slots.map((slot) => (
                        <Button
                          key={slot.startsAt}
                          type="button"
                          variant="outline"
                          disabled={submitting}
                          aria-label={formatSlotLabel(
                            conflict.date,
                            slot.startsAt,
                            slot.endsAt,
                            timeZone,
                          )}
                          onClick={() => bookSlot(slot)}
                        >
                          {formatTimeRange(slot.startsAt, slot.endsAt, timeZone)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {booking.state === 'error' && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/40 bg-destructive/5 p-4"
                >
                  <p className="text-sm text-destructive">
                    Не удалось забронировать слот. Попробуйте ещё раз.
                  </p>
                </div>
              )}

              {slots.state !== 'idle' && (
                <LoadStateNotice
                  state={slots.state}
                  loadingText="Загружаем слоты…"
                  errorText="Не удалось загрузить слоты."
                  onRetry={retrySlots}
                />
              )}

              {slots.refreshing && (
                <p className="text-sm text-muted-foreground">Обновляем слоты…</p>
              )}

              {calendarVisible && slots.data && (
                <SlotCalendar
                  data={slots.data}
                  onSelectSlot={bookSlot}
                  disabled={submitting}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
