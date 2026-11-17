import "@typespec/http";
import "@typespec/json-schema";

using TypeSpec.Http;
using TypeSpec.JsonSchema;

/** API сервиса бронирования календаря звонков. Контракт — источник истины для бэкенда и фронтенда. */
@service(#{ title: "Календарь звонков" })
@server("http://localhost:8080", "Локальный бэкенд")
namespace CalendarApi;

/** Тип встречи, созданный владельцем. */
model MeetingType {
  @format("uuid")
  id: string;
  /** Название после trim: 1–100 символов. */
  @minLength(1)
  @maxLength(100)
  name: string;
  /** Описание после trim: 1–500 символов. */
  @minLength(1)
  @maxLength(500)
  description: string;
  /** Длительность слота в минутах: 5–480, кратно 5. */
  @minValue(5)
  @maxValue(480)
  @multipleOf(5)
  durationMinutes: int32;
}

/** Данные для создания типа встречи. */
model MeetingTypeCreate {
  /** Название после trim: 1–100 символов. */
  @minLength(1)
  @maxLength(100)
  name: string;
  /** Описание после trim: 1–500 символов. */
  @minLength(1)
  @maxLength(500)
  description: string;
  /** 5–480 минут, кратно 5. */
  @minValue(5)
  @maxValue(480)
  @multipleOf(5)
  durationMinutes: int32;
}

/** Свободный слот: полуинтервал [startsAt, endsAt). */
model Slot {
  startsAt: offsetDateTime;
  endsAt: offsetDateTime;
}

/** Слоты одного календарного дня окна бронирования. */
model DaySlots {
  date: plainDate;
  slots: Slot[];
}

/** Окно бронирования: сегодня и следующие 13 календарных дней. */
model BookingWindow {
  from: plainDate;
  to: plainDate;
}

model SlotListResponse {
  timeZone: string;
  window: BookingWindow;
  days: DaySlots[];
}

model MeetingTypeListResponse {
  items: MeetingType[];
}

/** Краткие данные типа встречи внутри встречи. */
model MeetingTypeSummary {
  @format("uuid")
  id: string;
  name: string;
  durationMinutes: int32;
}

/** Забронированная встреча. */
model Meeting {
  @format("uuid")
  id: string;
  meetingType: MeetingTypeSummary;
  startsAt: offsetDateTime;
  endsAt: offsetDateTime;
}

/** Запрос на бронирование слота. */
model MeetingRequest {
  @format("uuid")
  meetingTypeId: string;
  startsAt: offsetDateTime;
}

model UpcomingMeetingsResponse {
  timeZone: string;
  window: BookingWindow;
  items: Meeting[];
}

model FieldError {
  field: string;
  message: string;
}

/** Единый конверт ошибки. */
model ErrorResponse {
  code: string;
  message: string;
}

model ValidationErrorResponse extends ErrorResponse {
  fieldErrors?: FieldError[];
}

/** Ошибка занятого слота: альтернативы того же дня после пересечения. */
model SlotTakenResponse extends ErrorResponse {
  date: plainDate;
  slots: Slot[];
}

model MeetingTypeCreatedResponse {
  @statusCode statusCode: 201;
  @header("Location") location: string;
  @body body: MeetingType;
}

model MeetingCreatedResponse {
  @statusCode statusCode: 201;
  @body body: Meeting;
}

@error
model BadRequestResponse {
  @statusCode statusCode: 400;
  @body body: ValidationErrorResponse;
}

@error
model InvalidSlotResponse {
  @statusCode statusCode: 400;
  @body body: ErrorResponse;
}

@error
model MeetingTypeNotFoundResponse {
  @statusCode statusCode: 404;
  @body body: ErrorResponse;
}

@error
model SlotTakenErrorResponse {
  @statusCode statusCode: 409;
  @body body: SlotTakenResponse;
}

@route("/api/meeting-types")
@tag("Meeting types")
interface MeetingTypes {
  /** Список типов встреч, созданных владельцем. */
  @get
  list(): MeetingTypeListResponse;

  /** Создать тип встречи. */
  @post
  create(@body body: MeetingTypeCreate): MeetingTypeCreatedResponse | BadRequestResponse;

  /** Свободные слоты типа встречи на всё окно бронирования. */
  @get
  @route("/{meetingTypeId}/slots")
  slots(@path @format("uuid") meetingTypeId: string): SlotListResponse | MeetingTypeNotFoundResponse;
}

@route("/api/meetings")
@tag("Meetings")
interface Meetings {
  /** Забронировать слот. Проверка пересечения и вставка атомарны. */
  @post
  book(@body body: MeetingRequest):
    | MeetingCreatedResponse
    | BadRequestResponse
    | InvalidSlotResponse
    | MeetingTypeNotFoundResponse
    | SlotTakenErrorResponse;

  /** Предстоящие встречи в окне бронирования, отсортированные по началу. */
  @get
  @route("/upcoming")
  upcoming(): UpcomingMeetingsResponse;
}
