package ru.hexlet._6.api;

import ru.hexlet._6.domain.MeetingType;

/** Краткие данные типа встречи внутри встречи. */
public record MeetingTypeSummaryResponse(String id, String name, int durationMinutes) {

  /**
   * Сводка типа встречи. Длительность передаётся явно: во встрече она зафиксирована на момент
   * брони, поэтому не обязана совпадать с текущей длительностью типа.
   */
  public static MeetingTypeSummaryResponse of(String id, String name, int durationMinutes) {
    return new MeetingTypeSummaryResponse(id, name, durationMinutes);
  }

  /** Сводка по актуальному типу встречи. */
  public static MeetingTypeSummaryResponse of(MeetingType meetingType) {
    return of(meetingType.id().toString(), meetingType.name(), meetingType.durationMinutes());
  }
}
