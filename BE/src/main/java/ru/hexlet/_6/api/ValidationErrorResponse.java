package ru.hexlet._6.api;

import java.util.List;

/** Ошибка валидации с разбивкой по полям. */
public record ValidationErrorResponse(
    String code, String message, List<FieldErrorResponse> fieldErrors) {}
