package ru.hexlet._6.api;

/** Тип встречи, для которого запросили слоты, не найден. */
public class MeetingTypeNotFoundException extends RuntimeException {

  public MeetingTypeNotFoundException() {
    super("Тип встречи не найден");
  }
}
