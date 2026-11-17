package ru.hexlet._6.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.OffsetDateTime;

/** Тело запроса на бронирование слота. */
public record CreateMeetingRequest(
    @NotBlank(message = "Укажите тип встречи") String meetingTypeId,
    @NotNull(message = "Укажите начало встречи") OffsetDateTime startsAt) {}
