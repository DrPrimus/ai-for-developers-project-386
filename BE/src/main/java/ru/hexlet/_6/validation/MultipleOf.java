package ru.hexlet._6.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;
import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/** Проверяет, что числовое значение кратно заданному шагу. */
@Documented
@Constraint(validatedBy = MultipleOfValidator.class)
@Target({
  ElementType.FIELD,
  ElementType.METHOD,
  ElementType.PARAMETER,
  ElementType.ANNOTATION_TYPE,
  ElementType.RECORD_COMPONENT
})
@Retention(RetentionPolicy.RUNTIME)
public @interface MultipleOf {

  int value();

  String message() default "Значение должно быть кратно {value}";

  Class<?>[] groups() default {};

  Class<? extends Payload>[] payload() default {};
}
