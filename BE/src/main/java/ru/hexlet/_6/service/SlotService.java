package ru.hexlet._6.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import ru.hexlet._6.api.BookingWindowResponse;
import ru.hexlet._6.api.DaySlotsResponse;
import ru.hexlet._6.api.SlotListResponse;
import ru.hexlet._6.api.SlotResponse;
import ru.hexlet._6.domain.CalendarRules;
import ru.hexlet._6.domain.Meeting;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.store.InMemoryStore;

/**
 * Считает свободные слоты типа встречи на всё окно бронирования.
 *
 * <p>Для каждого дня окна, включая выходные и пустые дни: выходной даёт пустой список; рабочий
 * интервал разбивается встречами на свободные куски, и в каждом куске строится непрерывная цепочка
 * от его начала с шагом длительности типа. Кандидат, который не помещается в свободный кусок
 * целиком, отбрасывается вместе с остатком куска. В конце отбрасываются кандидаты, начавшиеся не
 * позже текущего момента; на построение цепочки это уже не влияет.
 */
@Service
public class SlotService {

  private final Clock clock;
  private final InMemoryStore store;

  public SlotService(Clock clock, InMemoryStore store) {
    this.clock = clock;
    this.store = store;
  }

  /** Свободные слоты типа встречи на окно, начиная с сегодняшней даты в часовом поясе сервиса. */
  public SlotListResponse slotsFor(MeetingType meetingType) {
    Instant now = clock.instant();
    LocalDate today = LocalDate.ofInstant(now, CalendarRules.TIME_ZONE);
    LocalDate lastDay = CalendarRules.windowLastDay(today);
    List<Meeting> meetings = store.meetings();

    List<DaySlotsResponse> days = new ArrayList<>();
    for (LocalDate date = today; !date.isAfter(lastDay); date = date.plusDays(1)) {
      days.add(
          new DaySlotsResponse(
              date, buildDaySlots(date, meetingType.durationMinutes(), meetings, now)));
    }

    return new SlotListResponse(
        CalendarRules.TIME_ZONE.getId(),
        new BookingWindowResponse(today, lastDay),
        List.copyOf(days));
  }

  /** Свободные слоты одного дня; выходной даёт пустой список. */
  public List<SlotResponse> slotsForDay(MeetingType meetingType, LocalDate date) {
    return buildDaySlots(date, meetingType.durationMinutes(), store.meetings(), clock.instant());
  }

  private static List<SlotResponse> buildDaySlots(
      LocalDate date, int durationMinutes, List<Meeting> meetings, Instant now) {
    if (!CalendarRules.isWorkDay(date)) {
      return List.of();
    }

    OffsetDateTime workStart = CalendarRules.workDayStart(date);
    OffsetDateTime workEnd = CalendarRules.workDayEnd(date);

    List<Meeting> meetingsOfDay =
        meetings.stream()
            .filter(meeting -> meeting.startsAt().isBefore(workEnd.toInstant()))
            .filter(meeting -> meeting.endsAt().isAfter(workStart.toInstant()))
            .sorted(Comparator.comparing(Meeting::startsAt))
            .toList();

    List<SlotResponse> slots = new ArrayList<>();
    OffsetDateTime cursor = workStart;
    for (Meeting meeting : meetingsOfDay) {
      OffsetDateTime meetingStart =
          OffsetDateTime.ofInstant(meeting.startsAt(), CalendarRules.TIME_ZONE);
      OffsetDateTime meetingEnd =
          OffsetDateTime.ofInstant(meeting.endsAt(), CalendarRules.TIME_ZONE);

      if (meetingStart.isAfter(cursor)) {
        OffsetDateTime freeEnd = meetingStart.isAfter(workEnd) ? workEnd : meetingStart;
        addChain(slots, cursor, freeEnd, durationMinutes, now);
      }
      if (meetingEnd.isAfter(cursor)) {
        cursor = meetingEnd.isAfter(workEnd) ? workEnd : meetingEnd;
      }
    }
    addChain(slots, cursor, workEnd, durationMinutes, now);

    return List.copyOf(slots);
  }

  private static void addChain(
      List<SlotResponse> slots,
      OffsetDateTime freeStart,
      OffsetDateTime freeEnd,
      int durationMinutes,
      Instant now) {
    OffsetDateTime candidate = freeStart;
    while (!candidate.plusMinutes(durationMinutes).isAfter(freeEnd)) {
      if (candidate.toInstant().isAfter(now)) {
        slots.add(new SlotResponse(candidate, candidate.plusMinutes(durationMinutes)));
      }
      candidate = candidate.plusMinutes(durationMinutes);
    }
  }
}
