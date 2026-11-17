package ru.hexlet._6.store;

import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.locks.ReentrantLock;
import org.springframework.stereotype.Component;
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

  public InMemoryStore(Clock clock) {
    this.clock = clock;
  }

  /** Снимок типов встреч в порядке создания. */
  public List<MeetingType> meetingTypes() {
    return meetingTypes;
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
   * Очищает хранилище; используется тестами, чтобы каждый сценарий начинался с пустого состояния.
   */
  public void clear() {
    writeLock.lock();
    try {
      meetingTypes = List.of();
    } finally {
      writeLock.unlock();
    }
  }
}
