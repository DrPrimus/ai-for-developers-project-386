package ru.hexlet._6.api;

import java.time.LocalDate;
import java.util.List;

/** Ошибка занятого слота: свободные альтернативы того же дня после конфликта. */
public record SlotConflictResponse(
    String code, String message, LocalDate date, List<SlotResponse> slots) {}
