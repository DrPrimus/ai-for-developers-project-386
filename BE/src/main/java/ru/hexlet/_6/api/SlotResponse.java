package ru.hexlet._6.api;

import java.time.OffsetDateTime;

/** Свободный слот: полуинтервал [startsAt, endsAt). */
public record SlotResponse(OffsetDateTime startsAt, OffsetDateTime endsAt) {}
