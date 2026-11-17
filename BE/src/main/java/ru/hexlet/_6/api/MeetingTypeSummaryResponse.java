package ru.hexlet._6.api;

import ru.hexlet._6.domain.MeetingType;

/** Краткие данные типа встречи внутри встречи. */
public record MeetingTypeSummaryResponse(String id, String name, int durationMinutes) {

  public static MeetingTypeSummaryResponse from(MeetingType meetingType) {
    return new MeetingTypeSummaryResponse(
        meetingType.id().toString(), meetingType.name(), meetingType.durationMinutes());
  }
}
