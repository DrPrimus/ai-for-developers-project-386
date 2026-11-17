package ru.hexlet._6.api;

/** Ошибка формата конкретного поля запроса: разбирается в {@code 400 VALIDATION_FAILED}. */
public class InvalidRequestFieldException extends RuntimeException {

  private final String field;

  public InvalidRequestFieldException(String field, String message) {
    super(message);
    this.field = field;
  }

  public String getField() {
    return field;
  }
}
