package ru.hexlet._6.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.hexlet._6.domain.CalendarRules;
import ru.hexlet._6.validation.MultipleOf;

/** Тело запроса на создание типа встречи. */
public record CreateMeetingTypeRequest(
    @NotBlank(message = "Укажите название")
        @Size(max = 100, message = "Название должно быть не длиннее 100 символов")
        String name,
    @NotBlank(message = "Укажите описание")
        @Size(max = 500, message = "Описание должно быть не длиннее 500 символов")
        String description,
    @NotNull(message = "Укажите длительность")
        @Min(
            value = CalendarRules.MIN_DURATION_MINUTES,
            message = "Длительность должна быть от 5 до 480 минут")
        @Max(
            value = CalendarRules.MAX_DURATION_MINUTES,
            message = "Длительность должна быть от 5 до 480 минут")
        @MultipleOf(
            value = CalendarRules.DURATION_STEP_MINUTES,
            message = "Длительность должна быть кратна 5 минутам")
        Integer durationMinutes) {}
