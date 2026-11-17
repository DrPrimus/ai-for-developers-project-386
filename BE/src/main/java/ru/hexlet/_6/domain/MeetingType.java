package ru.hexlet._6.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Тип встречи, созданный владельцем.
 *
 * @param id идентификатор
 * @param name название после trim
 * @param description описание после trim
 * @param durationMinutes длительность слота в минутах: 5–480, кратно 5
 * @param createdAt момент создания; задаёт порядок в списке
 */
public record MeetingType(
    UUID id, String name, String description, int durationMinutes, Instant createdAt) {}
