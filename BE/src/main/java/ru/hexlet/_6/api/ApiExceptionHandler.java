package ru.hexlet._6.api;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Переводит ошибки запроса в единый конверт API. */
@RestControllerAdvice
public class ApiExceptionHandler {

  /** Ошибки Bean Validation: поля и сообщения для формы владельца. */
  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ValidationErrorResponse> handleValidation(
      MethodArgumentNotValidException exception) {
    List<FieldErrorResponse> fieldErrors =
        exception.getBindingResult().getFieldErrors().stream()
            .map(ApiExceptionHandler::toFieldError)
            .toList();
    return ResponseEntity.badRequest()
        .body(
            new ValidationErrorResponse(
                "VALIDATION_FAILED", "Проверьте заполнение полей", fieldErrors));
  }

  /** Тело запроса отсутствует или не разбирается как JSON. */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ErrorResponse> handleUnreadableBody(
      HttpMessageNotReadableException exception) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(new ErrorResponse("VALIDATION_FAILED", "Тело запроса не разобрано"));
  }

  /** Неизвестный тип встречи: и синтаксически неверный идентификатор тоже. */
  @ExceptionHandler(MeetingTypeNotFoundException.class)
  public ResponseEntity<ErrorResponse> handleMeetingTypeNotFound(
      MeetingTypeNotFoundException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse("MEETING_TYPE_NOT_FOUND", exception.getMessage()));
  }

  private static FieldErrorResponse toFieldError(FieldError fieldError) {
    return new FieldErrorResponse(fieldError.getField(), fieldError.getDefaultMessage());
  }
}
