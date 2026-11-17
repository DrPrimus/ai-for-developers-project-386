package ru.hexlet._6.api;

import java.time.LocalDate;
import java.util.List;

/** Слоты одного календарного дня окна; в выходные и занятые дни список пуст. */
public record DaySlotsResponse(LocalDate date, List<SlotResponse> slots) {}
