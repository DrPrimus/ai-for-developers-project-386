package ru.hexlet._6.store;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;
import ru.hexlet._6.domain.Meeting;
import ru.hexlet._6.domain.MeetingType;

/**
 * Хранилище в памяти процесса. Singleton-бин: после перезапуска данные теряются.
 *
 * <p>Запись идёт под одним {@link ReentrantLock}, чтения используют неизменяемые volatile-снимки и
 * не блокируются. Тот же замок позже защитит атомарную проверку пересечений и вставку встречи.
 */
@Component
public class InMemoryStore {

  private final ReentrantLock writeLock = new ReentrantLock();
  private final Clock clock;
  private volatile List<MeetingType> meetingTypes = List.of();
  private volatile List<Meeting> meetings = List.of();

  public InMemoryStore(Clock clock) {
    this.clock = clock;
  }

  /**
   * Выполняет действие под блокировкой записи. Нужна для атомарности «проверить состояние и
   * изменить его»: например, для проверки пересечений и вставки встречи. Блокировка реентрантная,
   * поэтому внутри можно вызывать {@link #createMeeting}.
   */
  public <T> T withWriteLock(Supplier<T> action) {
    writeLock.lock();
    try {
      return action.get();
    } finally {
      writeLock.unlock();
    }
  }

  /** Снимок типов встреч в порядке создания. */
  public List<MeetingType> meetingTypes() {
    return meetingTypes;
  }

  /** Снимок встреч в порядке добавления. */
  public List<Meeting> meetings() {
    return meetings;
  }

  /** Находит тип встречи по идентификатору. */
  public Optional<MeetingType> meetingType(UUID id) {
    return meetingTypes.stream().filter(type -> type.id().equals(id)).findFirst();
  }

  /** Создаёт тип встречи. */
  public MeetingType createMeetingType(String name, String description, int durationMinutes) {
    writeLock.lock();
    try {
      MeetingType created =
          new MeetingType(UUID.randomUUID(), name, description, durationMinutes, clock.instant());
      List<MeetingType> next = new ArrayList<>(meetingTypes);
      next.add(created);
      meetingTypes = List.copyOf(next);
      return created;
    } finally {
      writeLock.unlock();
    }
  }

  /**
   * Добавляет встречу. Проверку пересечений и допустимости слота выполняет вызывающая сторона:
   * {@link #withWriteLock} держит блокировку на всё время проверки и вставки.
   */
  public Meeting createMeeting(
      UUID meetingTypeId, int durationMinutes, Instant startsAt, Instant endsAt) {
    writeLock.lock();
    try {
      Meeting created =
          new Meeting(UUID.randomUUID(), meetingTypeId, durationMinutes, startsAt, endsAt);
      List<Meeting> next = new ArrayList<>(meetings);
      next.add(created);
      meetings = List.copyOf(next);
      return created;
    } finally {
      writeLock.unlock();
    }
  }

  /**
   * Очищает хранилище; используется тестами, чтобы каждый сценарий начинался с пустого состояния.
   */
  public void clear() {
    writeLock.lock();
    try {
      meetingTypes = List.of();
      meetings = List.of();
    } finally {
      writeLock.unlock();
    }
  }
}
