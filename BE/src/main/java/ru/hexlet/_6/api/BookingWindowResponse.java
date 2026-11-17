package ru.hexlet._6.api;

import java.time.LocalDate;

/** Окно бронирования: сегодня и следующие 13 календарных дней. */
public record BookingWindowResponse(LocalDate from, LocalDate to) {}
