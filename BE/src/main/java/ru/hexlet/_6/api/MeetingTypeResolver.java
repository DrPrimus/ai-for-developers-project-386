package ru.hexlet._6.api;

import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.store.InMemoryStore;

/** Разбор идентификатора типа встречи и его поиск: общая часть обоих контроллеров. */
@Component
public class MeetingTypeResolver {

  private final InMemoryStore store;

  public MeetingTypeResolver(InMemoryStore store) {
    this.store = store;
  }

  /** Разбирает идентификатор; пусто, если строка не является UUID. */
  public Optional<UUID> parseId(String rawId) {
    try {
      return Optional.of(UUID.fromString(rawId));
    } catch (IllegalArgumentException exception) {
      return Optional.empty();
    }
  }

  /** Находит тип встречи по разобранному идентификатору; неизвестный тип — 404. */
  public MeetingType require(UUID id) {
    return store.meetingType(id).orElseThrow(MeetingTypeNotFoundException::new);
  }

  /** Находит тип встречи по сырой строке: и неизвестный, и неразбираемый идентификатор — 404. */
  public MeetingType require(String rawId) {
    return require(parseId(rawId).orElseThrow(MeetingTypeNotFoundException::new));
  }
}
