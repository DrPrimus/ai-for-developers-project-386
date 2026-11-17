import { useEffect, useState, type FormEvent } from 'react'

import { ApiError, createMeetingType, listMeetingTypes, type MeetingType } from '@/api/client'
import { LoadStateNotice, type LoadState } from '@/components/LoadStateNotice'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const EMPTY_FORM = { name: '', description: '', duration: '' }

function formatDuration(minutes: number) {
  return `${minutes} мин`
}

function fieldErrorsToMap(error: unknown): Record<string, string> {
  if (error instanceof ApiError) {
    return Object.fromEntries(error.fieldErrors.map((item) => [item.field, item.message]))
  }
  return {}
}

export function MeetingTypesCard() {
  const [items, setItems] = useState<MeetingType[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  /** Единственный загрузчик списка: и первый показ, и обновление после создания. */
  useEffect(() => {
    let active = true
    listMeetingTypes()
      .then((loaded) => {
        if (!active) return
        setItems(loaded)
        setLoadState('ready')
      })
      .catch(() => {
        if (active) setLoadState('error')
      })
    return () => {
      active = false
    }
  }, [reloadToken])

  function retry() {
    setLoadState('loading')
    setReloadToken((token) => token + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFieldErrors({})
    setFormError(null)
    setCreated(false)

    try {
      await createMeetingType({
        name: form.name,
        description: form.description,
        durationMinutes: Number(form.duration),
      })
      setForm(EMPTY_FORM)
      setCreated(true)
      setReloadToken((token) => token + 1)
    } catch (error) {
      const errors = fieldErrorsToMap(error)
      setFieldErrors(errors)
      if (Object.keys(errors).length === 0) {
        setFormError(
          error instanceof Error ? error.message : 'Не удалось создать тип встречи',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="font-heading text-xl font-semibold">Типы встреч</h2>
        </CardTitle>
        <CardDescription>
          Название, описание и длительность — этот тип увидят гости на странице
          записи.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="grid gap-2">
            <Label htmlFor="meeting-type-name">Название</Label>
            <Input
              id="meeting-type-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? 'meeting-type-name-error' : undefined
              }
            />
            {fieldErrors.name && (
              <p
                id="meeting-type-name-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meeting-type-description">Описание</Label>
            <Textarea
              id="meeting-type-description"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
              aria-invalid={Boolean(fieldErrors.description)}
              aria-describedby={
                fieldErrors.description
                  ? 'meeting-type-description-error'
                  : undefined
              }
            />
            {fieldErrors.description && (
              <p
                id="meeting-type-description-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meeting-type-duration">Длительность, минут</Label>
            <Input
              id="meeting-type-duration"
              type="number"
              min={5}
              max={480}
              step={5}
              inputMode="numeric"
              value={form.duration}
              onChange={(event) =>
                setForm({ ...form, duration: event.target.value })
              }
              aria-invalid={Boolean(fieldErrors.durationMinutes)}
              aria-describedby={
                fieldErrors.durationMinutes
                  ? 'meeting-type-duration-hint meeting-type-duration-error'
                  : 'meeting-type-duration-hint'
              }
            />
            <p
              id="meeting-type-duration-hint"
              className="text-sm text-muted-foreground"
            >
              От 5 до 480 минут, кратно 5.
            </p>
            {fieldErrors.durationMinutes && (
              <p
                id="meeting-type-duration-error"
                role="alert"
                className="text-sm text-destructive"
              >
                {fieldErrors.durationMinutes}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}

          {created && (
            <p role="status" className="text-sm text-emerald-600">
              Тип встречи создан.
            </p>
          )}

          <Button type="submit" disabled={submitting} className="self-start">
            {submitting ? 'Создаём…' : 'Создать тип встречи'}
          </Button>
        </form>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-lg font-semibold">
            Созданные типы встреч
          </h3>

          {loadState !== 'ready' || items.length === 0 ? (
            <LoadStateNotice
              state={loadState}
              loadingText="Загружаем типы встреч…"
              errorText="Не удалось загрузить типы встреч."
              emptyText="Пока нет типов встреч."
              onRetry={retry}
            />
          ) : (
            <ul aria-label="Типы встреч" className="flex flex-col gap-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-medium">{item.name}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {formatDuration(item.durationMinutes)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
