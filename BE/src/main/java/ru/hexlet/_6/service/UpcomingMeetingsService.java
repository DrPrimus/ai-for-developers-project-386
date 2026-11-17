package ru.hexlet._6.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import ru.hexlet._6.api.BookingWindowResponse;
import ru.hexlet._6.api.MeetingResponse;
import ru.hexlet._6.api.MeetingTypeSummaryResponse;
import ru.hexlet._6.api.UpcomingMeetingsResponse;
import ru.hexlet._6.domain.CalendarRules;
import ru.hexlet._6.domain.Meeting;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.store.InMemoryStore;

/**
 * Список предстоящих встреч для владельца.
 *
 * <p>Встреча попадает в список, только если её начало строго позже текущего момента и лежит внутри
 * окна бронирования; порядок — по началу по возрастанию. Длительность в сводке типа — снимок
 * момента брони, поэтому список не зависит от последующих изменений типа встречи.
 */
@Service
public class UpcomingMeetingsService {

  private final Clock clock;
  private final InMemoryStore store;

  public UpcomingMeetingsService(Clock clock, InMemoryStore store) {
    this.clock = clock;
    this.store = store;
  }

  /** Предстоящие встречи окна, отсортированные по началу. */
  public UpcomingMeetingsResponse upcoming() {
    Instant now = clock.instant();
    LocalDate today = LocalDate.ofInstant(now, CalendarRules.TIME_ZONE);

    List<MeetingResponse> items =
        store.meetings().stream()
            .filter(meeting -> meeting.startsAt().isAfter(now))
            .filter(meeting ->
                CalendarRules.isWithinWindow(
                    LocalDate.ofInstant(meeting.startsAt(), CalendarRules.TIME_ZONE), today))
            .sorted(Comparator.comparing(Meeting::startsAt))
            .map(this::toResponse)
            .toList();

    return new UpcomingMeetingsResponse(
        CalendarRules.TIME_ZONE.getId(),
        new BookingWindowResponse(today, CalendarRules.windowLastDay(today)),
        items);
  }

  private MeetingResponse toResponse(Meeting meeting) {
    MeetingType type =
        store
            .meetingType(meeting.meetingTypeId())
            .orElseThrow(() ->
                new IllegalStateException(
                    "Встреча ссылается на несуществующий тип: " + meeting.meetingTypeId()));
    return MeetingResponse.from(
        meeting,
        MeetingTypeSummaryResponse.of(
            type.id().toString(), type.name(), meeting.durationMinutes()));
  }
}
