package ru.hexlet._6.api;

import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.hexlet._6.domain.MeetingType;
import ru.hexlet._6.service.BookingService;
import ru.hexlet._6.service.UpcomingMeetingsService;

/** Бронирование встреч гостем. */
@RestController
@RequestMapping("/api/meetings")
public class MeetingController {

  private static final String INVALID_MEETING_TYPE_ID =
      "Укажите корректный идентификатор типа встречи";

  private final MeetingTypeResolver meetingTypeResolver;
  private final BookingService bookingService;
  private final UpcomingMeetingsService upcomingMeetingsService;

  public MeetingController(
      MeetingTypeResolver meetingTypeResolver,
      BookingService bookingService,
      UpcomingMeetingsService upcomingMeetingsService) {
    this.meetingTypeResolver = meetingTypeResolver;
    this.bookingService = bookingService;
    this.upcomingMeetingsService = upcomingMeetingsService;
  }

  /** Предстоящие встречи окна: начало строго позже текущего момента, порядок по началу. */
  @GetMapping("/upcoming")
  public UpcomingMeetingsResponse upcoming() {
    return upcomingMeetingsService.upcoming();
  }

  /**
   * Бронирует слот: сначала проверяется формат идентификатора типа (400) и его существование (404),
   * затем время (400), затем пересечение с любой встречей (409 с альтернативами) и правило цепочки
   * (400).
   */
  @PostMapping
  public ResponseEntity<Object> book(@Valid @RequestBody CreateMeetingRequest request) {
    UUID meetingTypeId =
        meetingTypeResolver
            .parseId(request.meetingTypeId())
            .orElseThrow(
                () -> new InvalidRequestFieldException("meetingTypeId", INVALID_MEETING_TYPE_ID));
    MeetingType meetingType = meetingTypeResolver.require(meetingTypeId);

    BookingService.Result result = bookingService.book(meetingType, request.startsAt().toInstant());

    return switch (result) {
      case BookingService.Result.Booked booked ->
          ResponseEntity.status(HttpStatus.CREATED)
              .body(MeetingResponse.from(booked.meeting(), meetingType));
      case BookingService.Result.Overlap overlap ->
          ResponseEntity.status(HttpStatus.CONFLICT)
              .body(
                  new SlotTakenResponse(
                      "SLOT_TAKEN", "Слот уже занят", overlap.date(), overlap.slots()));
      case BookingService.Result.InvalidSlot ignored ->
          ResponseEntity.badRequest()
              .body(new ErrorResponse("INVALID_SLOT", "Это время недоступно для бронирования"));
    };
  }
}
