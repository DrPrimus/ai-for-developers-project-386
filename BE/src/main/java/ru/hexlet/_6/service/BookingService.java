package ru.hexlet._6.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.stereotype.Service;
import ru.hexlet._6.api.SlotResponse;
import ru.hexlet._6.domain.CalendarRules;
import ru.hexlet._6.domain.Meeting;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.store.InMemoryStore;

/**
 * Создаёт встречу по запросу гостя.
 *
 * <p>Проверка структурной допустимости слота, проверка пересечения и вставка идут одной атомарной
 * операцией под блокировкой записи хранилища: между проверкой и вставкой не может проскочить
 * встречу другого запроса. Порядок проверок: сначала время (400), потом пересечение (409), потом
 * правило цепочки (400). Пересечение с любой встречей важнее того, что начало не является началом
 * свободного слота.
 */
@Service
public class BookingService {

  /** Результат попытки бронирования. */
  public sealed interface Result permits Result.Booked, Result.InvalidSlot, Result.Conflict {

    /** Встреча создана. */
    record Booked(Meeting meeting) implements Result {}

    /** Время структурно недопустимо или не совпадает с началом свободного слота. */
    record InvalidSlot() implements Result {}

    /** Слот пересекается с существующей встречей; альтернативы — свободные слоты того же дня. */
    record Conflict(LocalDate date, List<SlotResponse> slots) implements Result {}
  }

  private final Clock clock;
  private final InMemoryStore store;
  private final SlotService slotService;

  public BookingService(Clock clock, InMemoryStore store, SlotService slotService) {
    this.clock = clock;
    this.store = store;
    this.slotService = slotService;
  }

  /** Пытается забронировать начало {@code startsAt} для типа встречи. */
  public Result book(MeetingType meetingType, Instant startsAt) {
    return store.withWriteLock(() -> attempt(meetingType, startsAt));
  }

  private Result attempt(MeetingType meetingType, Instant startsAt) {
    Duration duration = Duration.ofMinutes(meetingType.durationMinutes());
    LocalDate date = LocalDate.ofInstant(startsAt, CalendarRules.TIME_ZONE);

    if (!isStructurallyValid(startsAt, duration, date)) {
      return new Result.InvalidSlot();
    }

    Instant endsAt = startsAt.plus(duration);
    if (store.meetings().stream().anyMatch(meeting -> overlaps(meeting, startsAt, endsAt))) {
      return new Result.Conflict(date, slotService.slotsForDay(meetingType, date));
    }

    boolean isSlotStart =
        slotService.slotsForDay(meetingType, date).stream()
            .anyMatch(slot -> slot.startsAt().toInstant().equals(startsAt));
    if (!isSlotStart) {
      return new Result.InvalidSlot();
    }

    Meeting created =
        store.createMeeting(meetingType.id(), meetingType.durationMinutes(), startsAt, endsAt);
    return new Result.Booked(created);
  }

  /** Полуинтервалы [start, end): конец одной встречи и начало следующей не пересекаются. */
  private static boolean overlaps(Meeting meeting, Instant startsAt, Instant endsAt) {
    return startsAt.isBefore(meeting.endsAt()) && meeting.startsAt().isBefore(endsAt);
  }

  private boolean isStructurallyValid(Instant startsAt, Duration duration, LocalDate date) {
    Instant now = clock.instant();
    if (!startsAt.isAfter(now)) {
      return false;
    }

    LocalDate today = LocalDate.ofInstant(now, CalendarRules.TIME_ZONE);
    LocalDate lastDay = today.plusDays(CalendarRules.BOOKING_WINDOW_DAYS - 1L);
    if (date.isBefore(today) || date.isAfter(lastDay)) {
      return false;
    }
    if (!CalendarRules.WORK_DAYS.contains(date.getDayOfWeek())) {
      return false;
    }

    OffsetDateTime workStart =
        date.atTime(CalendarRules.WORK_DAY_START)
            .atZone(CalendarRules.TIME_ZONE)
            .toOffsetDateTime();
    OffsetDateTime workEnd =
        date.atTime(CalendarRules.WORK_DAY_END).atZone(CalendarRules.TIME_ZONE).toOffsetDateTime();
    OffsetDateTime start = OffsetDateTime.ofInstant(startsAt, CalendarRules.TIME_ZONE);
    OffsetDateTime end = OffsetDateTime.ofInstant(startsAt.plus(duration), CalendarRules.TIME_ZONE);

    return !start.isBefore(workStart) && !end.isAfter(workEnd);
  }
}
