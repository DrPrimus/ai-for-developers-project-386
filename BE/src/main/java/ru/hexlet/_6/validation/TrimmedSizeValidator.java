package ru.hexlet._6.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** Валидатор {@link TrimmedSize}; null допустим, обязательность проверяется отдельно. */
public class TrimmedSizeValidator implements ConstraintValidator<TrimmedSize, String> {

  private int max;

  @Override
  public void initialize(TrimmedSize constraintAnnotation) {
    this.max = constraintAnnotation.max();
  }

  @Override
  public boolean isValid(String value, ConstraintValidatorContext context) {
    return value == null || value.strip().length() <= max;
  }
}
