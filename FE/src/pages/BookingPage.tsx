import { useEffect, useState } from 'react'

import {
  getSlots,
  listMeetingTypes,
  type MeetingType,
  type Slot,
  type SlotListResponse,
} from '@/api/client'
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

type LoadState = 'loading' | 'ready' | 'error'

type TypesState = { state: LoadState; items: MeetingType[] }
type SlotsState = { state: 'idle' | LoadState; data: SlotListResponse | null }

export function BookingPage() {
  const [types, setTypes] = useState<TypesState>({ state: 'loading', items: [] })
  const [typesReload, setTypesReload] = useState(0)
  const [selected, setSelected] = useState<MeetingType | null>(null)
  const [slots, setSlots] = useState<SlotsState>({ state: 'idle', data: null })
  const [slotsReload, setSlotsReload] = useState(0)

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
        if (active) setSlots({ state: 'ready', data })
      })
      .catch(() => {
        if (active) setSlots({ state: 'error', data: null })
      })
    return () => {
      active = false
    }
  }, [selected, slotsReload])

  function retryTypes() {
    setTypes({ state: 'loading', items: [] })
    setTypesReload((token) => token + 1)
  }

  function selectType(meetingType: MeetingType) {
    setSelected(meetingType)
    setSlots({ state: 'loading', data: null })
  }

  function retrySlots() {
    setSlots({ state: 'loading', data: null })
    setSlotsReload((token) => token + 1)
  }

  function backToTypes() {
    setSelected(null)
    setSlots({ state: 'idle', data: null })
  }

  /**
   * Шов бронирования (#13): создание встречи, успех и конфликт появятся здесь.
   * Пока нажатие на слот ничего не отправляет — календарь остаётся только витриной.
   */
  function handleSelectSlot(slot: Slot) {
    void slot
  }

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
                onClick={backToTypes}
              >
                ← Выбрать другой тип
              </Button>

              {slots.state === 'loading' && (
                <p className="text-sm text-muted-foreground">Загружаем слоты…</p>
              )}

              {slots.state === 'error' && (
                <div role="alert" className="flex flex-col items-start gap-2">
                  <p className="text-sm text-destructive">
                    Не удалось загрузить слоты.
                  </p>
                  <Button type="button" variant="outline" onClick={retrySlots}>
                    Повторить
                  </Button>
                </div>
              )}

              {slots.state === 'ready' && slots.data && (
                <SlotCalendar data={slots.data} onSelectSlot={handleSelectSlot} />
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
