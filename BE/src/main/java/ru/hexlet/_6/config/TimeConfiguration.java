package ru.hexlet._6.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import ru.hexlet._6.domain.CalendarRules;

/** Системные часы приложения. Тесты подменяют бин фиксированным временем. */
@Configuration(proxyBeanMethods = false)
public class TimeConfiguration {

  @Bean
  Clock clock() {
    return Clock.system(CalendarRules.TIME_ZONE);
  }
}
