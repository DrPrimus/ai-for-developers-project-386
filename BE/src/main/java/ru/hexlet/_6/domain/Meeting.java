package ru.hexlet._6.domain;

import java.time.Instant;
import java.util.UUID;

/**
 * Забронированная встреча.
 *
 * @param id идентификатор
 * @param meetingTypeId тип встречи, по которому она создана
 * @param durationMinutes длительность на момент брони: длительность типа могла бы измениться
 * @param startsAt начало; входит в интервал
 * @param endsAt окончание; не входит в интервал
 */
public record Meeting(
    UUID id, UUID meetingTypeId, int durationMinutes, Instant startsAt, Instant endsAt) {}
