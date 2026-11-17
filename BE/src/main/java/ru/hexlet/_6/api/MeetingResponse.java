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

  public static MeetingResponse from(Meeting meeting, MeetingType meetingType) {
    return new MeetingResponse(
        meeting.id().toString(),
        MeetingTypeSummaryResponse.from(meetingType),
        OffsetDateTime.ofInstant(meeting.startsAt(), CalendarRules.TIME_ZONE),
        OffsetDateTime.ofInstant(meeting.endsAt(), CalendarRules.TIME_ZONE));
  }
}
