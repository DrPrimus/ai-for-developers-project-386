package ru.hexlet._6.api;

import java.util.List;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import tools.jackson.core.JacksonException;

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

  /** Поле, которое не разбирается как значение своего типа: например, длительность строкой. */
  @ExceptionHandler(InvalidRequestFieldException.class)
  public ResponseEntity<ValidationErrorResponse> handleInvalidField(
      InvalidRequestFieldException exception) {
    return ResponseEntity.badRequest()
        .body(
            new ValidationErrorResponse(
                "VALIDATION_FAILED",
                exception.getMessage(),
                List.of(new FieldErrorResponse(exception.getField(), exception.getMessage()))));
  }

  /**
   * Тело запроса отсутствует или не разбирается как JSON. Если Jackson сообщает путь до поля,
   * ошибка возвращается как {@code fieldErrors} этого поля; иначе — общим сообщением.
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  public ResponseEntity<ValidationErrorResponse> handleUnreadableBody(
      HttpMessageNotReadableException exception) {
    List<FieldErrorResponse> fieldErrors =
        offendingField(exception)
            .map(field -> List.of(new FieldErrorResponse(field, "Проверьте формат значения")))
            .orElseGet(List::of);
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body(
            new ValidationErrorResponse(
                "VALIDATION_FAILED", "Тело запроса не разобрано", fieldErrors));
  }

  /** Неизвестный тип встречи: {@code 404}. */
  @ExceptionHandler(MeetingTypeNotFoundException.class)
  public ResponseEntity<ErrorResponse> handleMeetingTypeNotFound(
      MeetingTypeNotFoundException exception) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(new ErrorResponse("MEETING_TYPE_NOT_FOUND", exception.getMessage()));
  }

  /** Имя поля из пути исключения Jackson: первая ссылка с именем свойства. */
  private static Optional<String> offendingField(Throwable exception) {
    for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
      if (cause instanceof JacksonException jacksonException) {
        for (JacksonException.Reference reference : jacksonException.getPath()) {
          if (reference.getPropertyName() != null) {
            return Optional.of(reference.getPropertyName());
          }
        }
      }
    }
    return Optional.empty();
  }

  private static FieldErrorResponse toFieldError(FieldError fieldError) {
    return new FieldErrorResponse(fieldError.getField(), fieldError.getDefaultMessage());
  }
}
