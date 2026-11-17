package ru.hexlet._6.api;

import jakarta.validation.Valid;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.store.InMemoryStore;

/** Типы встреч: список для гостя и создание владельцем. */
@RestController
@RequestMapping("/api/meeting-types")
public class MeetingTypeController {

  private final InMemoryStore store;

  public MeetingTypeController(InMemoryStore store) {
    this.store = store;
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
}
