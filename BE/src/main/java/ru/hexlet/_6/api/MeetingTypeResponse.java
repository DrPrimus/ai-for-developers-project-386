package ru.hexlet._6.api;

import ru.hexlet._6.domain.MeetingType;

/** Тип встречи в ответах API. */
public record MeetingTypeResponse(String id, String name, String description, int durationMinutes) {

  public static MeetingTypeResponse from(MeetingType meetingType) {
    return new MeetingTypeResponse(
        meetingType.id().toString(),
        meetingType.name(),
        meetingType.description(),
        meetingType.durationMinutes());
  }
}
