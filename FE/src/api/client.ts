import type { components } from '@/api/schema'

/** Единственный сетевой шов приложения: страницы ходят в API только через эти функции. */
export type MeetingType = components['schemas']['MeetingType']
export type MeetingTypeCreate = components['schemas']['MeetingTypeCreate']
export type Slot = components['schemas']['Slot']
export type DaySlots = components['schemas']['DaySlots']
export type SlotListResponse = components['schemas']['SlotListResponse']
export type FieldError = components['schemas']['FieldError']
export type Meeting = components['schemas']['Meeting']
export type MeetingRequest = components['schemas']['MeetingRequest']
export type SlotTakenResponse = components['schemas']['SlotTakenResponse']
export type UpcomingMeetingsResponse =
  components['schemas']['UpcomingMeetingsResponse']

type ErrorBody = components['schemas']['ErrorResponse'] & {
  fieldErrors?: FieldError[]
  date?: string
  slots?: Slot[]
}

const API_BASE_URL = '/api'

/** Ошибка API: статус, машиночитаемый код, ошибки полей и альтернативы занятого слота. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: FieldError[]
  readonly date: string | null
  readonly slots: Slot[]

  constructor(status: number, body: Partial<ErrorBody>) {
    super(body.message ?? 'Не удалось выполнить запрос')
    this.name = 'ApiError'
    this.status = status
    this.code = body.code ?? 'UNKNOWN'
    this.fieldErrors = body.fieldErrors ?? []
    this.date = body.date ?? null
    this.slots = body.slots ?? []
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Не удалось связаться с сервером',
    })
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Partial<ErrorBody>
    throw new ApiError(response.status, body)
  }

  return (await response.json()) as T
}

/** Типы встреч в порядке создания. */
export async function listMeetingTypes(): Promise<MeetingType[]> {
  const body = await request<components['schemas']['MeetingTypeListResponse']>(
    '/meeting-types',
  )
  return body.items
}

/** Создаёт тип встречи от имени владельца. */
export function createMeetingType(input: MeetingTypeCreate): Promise<MeetingType> {
  return request<MeetingType>('/meeting-types', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** Свободные слоты типа встречи на всё окно бронирования. */
export function getSlots(meetingTypeId: string): Promise<SlotListResponse> {
  return request<SlotListResponse>(`/meeting-types/${meetingTypeId}/slots`)
}

/** Бронирует слот: создаёт встречу для выбранного типа. */
export function createMeeting(input: MeetingRequest): Promise<Meeting> {
  return request<Meeting>('/meetings', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

/** Предстоящие встречи окна в порядке начала. */
export function listUpcomingMeetings(): Promise<UpcomingMeetingsResponse> {
  return request<UpcomingMeetingsResponse>('/meetings/upcoming')
}
