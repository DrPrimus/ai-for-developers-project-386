package ru.hexlet._6.api;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.service.SlotService;
import ru.hexlet._6.store.InMemoryStore;

/** Типы встреч: список для гостя, создание владельцем и свободные слоты. */
@RestController
@RequestMapping("/api/meeting-types")
public class MeetingTypeController {

  private final InMemoryStore store;
  private final SlotService slotService;

  public MeetingTypeController(InMemoryStore store, SlotService slotService) {
    this.store = store;
    this.slotService = slotService;
  }

  @GetMapping
  public MeetingTypeListResponse list() {
    return new MeetingTypeListResponse(
        store.meetingTypes().stream().map(MeetingTypeResponse::from).toList());
  }

  @PostMapping
  public ResponseEntity<MeetingTypeResponse> create(
      @Valid @RequestBody CreateMeetingTypeRequest request) {
    MeetingType created =
        store.createMeetingType(
            request.name().trim(), request.description().trim(), request.durationMinutes());
    return ResponseEntity.created(URI.create("/api/meeting-types/" + created.id()))
        .body(MeetingTypeResponse.from(created));
  }

  /** Свободные слоты типа встречи на всё окно бронирования; неизвестный тип — 404. */
  @GetMapping("/{meetingTypeId}/slots")
  public SlotListResponse slots(@PathVariable String meetingTypeId) {
    MeetingType meetingType =
        parseUuid(meetingTypeId)
            .flatMap(store::meetingType)
            .orElseThrow(MeetingTypeNotFoundException::new);
    return slotService.slotsFor(meetingType);
  }

  private static Optional<UUID> parseUuid(String value) {
    try {
      return Optional.of(UUID.fromString(value));
    } catch (IllegalArgumentException exception) {
      return Optional.empty();
    }
  }
}
