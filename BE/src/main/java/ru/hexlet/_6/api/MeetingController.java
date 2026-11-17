package ru.hexlet._6.api;

import jakarta.validation.Valid;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.service.BookingService;
import ru.hexlet._6.store.InMemoryStore;

/** Бронирование встреч гостем. */
@RestController
@RequestMapping("/api/meetings")
public class MeetingController {

  private final InMemoryStore store;
  private final BookingService bookingService;

  public MeetingController(InMemoryStore store, BookingService bookingService) {
    this.store = store;
    this.bookingService = bookingService;
  }

  /**
   * Бронирует слот: сначала проверяется существование типа встречи (404), затем время (400), затем
   * пересечение с любой встречей (409 с альтернативами) и правило цепочки (400).
   */
  @PostMapping
  public ResponseEntity<Object> book(@Valid @RequestBody CreateMeetingRequest request) {
    MeetingType meetingType =
        parseUuid(request.meetingTypeId())
            .flatMap(store::meetingType)
            .orElseThrow(MeetingTypeNotFoundException::new);

    BookingService.Result result = bookingService.book(meetingType, request.startsAt().toInstant());

    return switch (result) {
      case BookingService.Result.Booked booked ->
          ResponseEntity.status(HttpStatus.CREATED)
              .body(MeetingResponse.from(booked.meeting(), meetingType));
      case BookingService.Result.Conflict conflict ->
          ResponseEntity.status(HttpStatus.CONFLICT)
              .body(
                  new SlotConflictResponse(
                      "SLOT_TAKEN", "Слот уже занят", conflict.date(), conflict.slots()));
      case BookingService.Result.InvalidSlot ignored ->
          ResponseEntity.badRequest()
              .body(new ErrorResponse("INVALID_SLOT", "Это время недоступно для бронирования"));
    };
  }

  private static Optional<UUID> parseUuid(String value) {
    try {
      return Optional.of(UUID.fromString(value));
    } catch (IllegalArgumentException exception) {
      return Optional.empty();
    }
  }
}
