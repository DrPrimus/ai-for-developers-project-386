package ru.hexlet._6.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** Валидатор {@link MultipleOf}; null считается допустимым, обязательность проверяется отдельно. */
public class MultipleOfValidator implements ConstraintValidator<MultipleOf, Number> {

  private int step;

  @Override
  public void initialize(MultipleOf constraintAnnotation) {
    this.step = constraintAnnotation.value();
  }

  @Override
  public boolean isValid(Number value, ConstraintValidatorContext context) {
    return value == null || value.longValue() % step == 0;
  }
}
