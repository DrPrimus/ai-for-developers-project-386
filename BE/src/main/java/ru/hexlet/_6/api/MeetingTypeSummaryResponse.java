package ru.hexlet._6.api;

import ru.hexlet._6.domain.MeetingType;

/** Краткие данные типа встречи внутри встречи. */
public record MeetingTypeSummaryResponse(String id, String name, int durationMinutes) {

  /** Сводка по типу встречи: длительность берётся из актуального типа. */
  public static MeetingTypeSummaryResponse from(MeetingType meetingType) {
    return of(meetingType.id().toString(), meetingType.name(), meetingType.durationMinutes());
  }

  /**
   * Сводка с длительностью, зафиксированной на момент брони: тип мог бы измениться, а встреча
   * должна показывать свою длительность.
   */
  public static MeetingTypeSummaryResponse of(String id, String name, int durationMinutes) {
    return new MeetingTypeSummaryResponse(id, name, durationMinutes);
  }
}
