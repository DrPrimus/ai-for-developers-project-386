package ru.hexlet._6.api;

/** Единый конверт ошибки API. */
public record ErrorResponse(String code, String message) {}
