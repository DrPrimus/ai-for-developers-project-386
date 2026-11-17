package ru.hexlet._6.api;

import java.util.List;

/** Предстоящие встречи в окне бронирования, отсортированные по началу. */
public record UpcomingMeetingsResponse(
    String timeZone, BookingWindowResponse window, List<MeetingResponse> items) {}
