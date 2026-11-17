package ru.hexlet._6.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Проверяет длину строки после trim.
 *
 * <p>Домен задаёт границы названия и описания «после trim», поэтому проверять сырую строку нельзя:
 * сто символов и пробел на конце — допустимое название.
 */
@Documented
@Constraint(validatedBy = TrimmedSizeValidator.class)
@Target({
  ElementType.FIELD,
  ElementType.METHOD,
  ElementType.PARAMETER,
  ElementType.ANNOTATION_TYPE,
  ElementType.RECORD_COMPONENT
})
@Retention(RetentionPolicy.RUNTIME)
public @interface TrimmedSize {

  int max() default Integer.MAX_VALUE;

  String message() default "Значение должно быть не длиннее {max} символов";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
