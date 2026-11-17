package ru.hexlet._6.api;

import java.util.List;

/** Свободные слоты типа встречи на всё окно бронирования. */
public record SlotListResponse(
    String timeZone, BookingWindowResponse window, List<DaySlotsResponse> days) {}
