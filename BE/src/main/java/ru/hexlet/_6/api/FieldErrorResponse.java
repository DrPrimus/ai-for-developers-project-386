package ru.hexlet._6.api;

/** Ошибка конкретного поля запроса. */
public record FieldErrorResponse(String field, String message) {}
