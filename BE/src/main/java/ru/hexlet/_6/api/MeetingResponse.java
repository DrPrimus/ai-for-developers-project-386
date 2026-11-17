package ru.hexlet._6.api;

import java.time.OffsetDateTime;
import ru.hexlet._6.domain.CalendarRules;
import ru.hexlet._6.domain.Meeting;
import ru.hexlet._6.domain.MeetingType;

/** Забронированная встреча в ответах API. */
public record MeetingResponse(
    String id,
    MeetingTypeSummaryResponse meetingType,
    OffsetDateTime startsAt,
    OffsetDateTime endsAt) {

  /** Встреча с типом, длительность которого берётся из типа. */
  public static MeetingResponse from(Meeting meeting, MeetingType meetingType) {
    return from(meeting, MeetingTypeSummaryResponse.of(meetingType));
  }

  /** Встреча с готовой сводкой типа: длительность может быть снимком на момент брони. */
  public static MeetingResponse from(Meeting meeting, MeetingTypeSummaryResponse meetingType) {
    return new MeetingResponse(
        meeting.id().toString(),
        meetingType,
        OffsetDateTime.ofInstant(meeting.startsAt(), CalendarRules.TIME_ZONE),
        OffsetDateTime.ofInstant(meeting.endsAt(), CalendarRules.TIME_ZONE));
  }
}
