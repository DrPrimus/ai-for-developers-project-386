package ru.hexlet._6.domain;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

/** Константы домена календаря: единственное место, где заданы правила времени и длительности. */
public final class CalendarRules {

  /** Часовой пояс сервиса: все слоты и рабочие часы считаются в нём. */
  public static final ZoneId TIME_ZONE = ZoneId.of("Europe/Moscow");

  /** Рабочие часы: начало первого слота. */
  public static final LocalTime WORK_DAY_START = LocalTime.of(9, 0);

  /** Рабочие часы: конец последнего слота (не включается). */
  public static final LocalTime WORK_DAY_END = LocalTime.of(18, 0);

  /** Рабочие дни недели; суббота и воскресенье — выходные. */
  public static final List<DayOfWeek> WORK_DAYS =
      List.of(
          DayOfWeek.MONDAY,
          DayOfWeek.TUESDAY,
          DayOfWeek.WEDNESDAY,
          DayOfWeek.THURSDAY,
          DayOfWeek.FRIDAY);

  /** Длина окна бронирования в календарных днях, включая сегодня. */
  public static final int BOOKING_WINDOW_DAYS = 14;

  /** Минимальная длительность типа встречи в минутах. */
  public static final int MIN_DURATION_MINUTES = 5;

  /** Максимальная длительность типа встречи в минутах. */
  public static final int MAX_DURATION_MINUTES = 480;

  /** Шаг длительности типа встречи в минутах. */
  public static final int DURATION_STEP_MINUTES = 5;

  private CalendarRules() {}
}
