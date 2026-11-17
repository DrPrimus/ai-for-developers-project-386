package ru.hexlet._6.api;

import java.util.List;

/** Список типов встреч в порядке создания. */
public record MeetingTypeListResponse(List<MeetingTypeResponse> items) {}
