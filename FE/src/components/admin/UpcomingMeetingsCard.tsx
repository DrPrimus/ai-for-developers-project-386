import { useEffect, useState } from 'react'

import {
  listUpcomingMeetings,
  type Meeting,
  type UpcomingMeetingsResponse,
} from '@/api/client'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  formatInstantDay,
  formatTimeRange,
  instantDateKey,
} from '@/lib/datetime'

type LoadState = 'loading' | 'ready' | 'error'

/** Пока вкладка видима, список перезапрашивается с этим шагом. */
const POLL_INTERVAL_MS = 10_000

type DayGroup = { key: string; heading: string; meetings: Meeting[] }

/** Группирует встречи по календарным дням часового пояса сервиса, внутри дня — по времени. */
function groupByDay(items: Meeting[], timeZone: string): DayGroup[] {
  const groups = new Map<string, Meeting[]>()
  for (const meeting of items) {
    const key = instantDateKey(meeting.startsAt, timeZone)
    groups.set(key, [...(groups.get(key) ?? []), meeting])
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, meetings]) => ({
      key,
      heading: formatInstantDay(meetings[0].startsAt, timeZone),
      meetings: [...meetings].sort(
        (left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt),
      ),
    }))
}

export function UpcomingMeetingsCard() {
  const [data, setData] = useState<UpcomingMeetingsResponse | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let active = true

    function load(showLoading: boolean) {
      if (showLoading) setLoadState('loading')
      listUpcomingMeetings()
        .then((loaded) => {
          if (!active) return
          setData(loaded)
          setLoadState('ready')
        })
        .catch(() => {
          if (active) setLoadState('error')
        })
    }

    /** Опрос и возврат фокуса обновляют список без экрана загрузки: данные уже на экране. */
    function refreshInBackground() {
      if (document.visibilityState === 'visible') load(false)
    }

    load(true)

    const interval = window.setInterval(refreshInBackground, POLL_INTERVAL_MS)
    window.addEventListener('focus', refreshInBackground)
    document.addEventListener('visibilitychange', refreshInBackground)

    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshInBackground)
      document.removeEventListener('visibilitychange', refreshInBackground)
    }
  }, [reloadToken])

  function refresh() {
    setLoadState('loading')
    setReloadToken((token) => token + 1)
  }

  const groups = data ? groupByDay(data.items, data.timeZone) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-heading text-xl font-semibold">Предстоящие встречи</h2>
        </CardTitle>
        <CardDescription>
          Записи гостей на ближайшие две недели. Список обновляется сам, пока
          вкладка открыта.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button
          type="button"
          variant="outline"
          className="self-start"
          onClick={refresh}
        >
          Обновить
        </Button>

        {loadState === 'loading' && (
          <p className="text-sm text-muted-foreground">
            Загружаем предстоящие встречи…
          </p>
        )}

        {loadState === 'error' && (
          <div role="alert" className="flex flex-col items-start gap-2">
            <p className="text-sm text-destructive">
              Не удалось загрузить предстоящие встречи.
            </p>
            <Button type="button" variant="outline" onClick={refresh}>
              Повторить
            </Button>
          </div>
        )}

        {loadState === 'ready' && groups.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Пока нет предстоящих встреч.
          </p>
        )}

        {loadState === 'ready' && data && groups.length > 0 && (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-label={group.heading}
                className="flex flex-col gap-2"
              >
                <h3 className="font-heading text-lg font-semibold">
                  {group.heading}
                </h3>
                <ul className="flex flex-col gap-2">
                  {group.meetings.map((meeting) => (
                    <li
                      key={meeting.id}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border bg-background p-4"
                    >
                      <span className="font-medium">
                        {meeting.meetingType.name}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {formatTimeRange(
                          meeting.startsAt,
                          meeting.endsAt,
                          data.timeZone,
                        )}{' '}
                        · {meeting.meetingType.durationMinutes} мин
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
