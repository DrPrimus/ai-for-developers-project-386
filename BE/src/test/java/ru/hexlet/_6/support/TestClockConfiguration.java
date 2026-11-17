package ru.hexlet._6.support;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Фиксированные часы для детерминированных HTTP-тестов: вторник, 17 ноября 2026, 09:00 MSK. */
@TestConfiguration(proxyBeanMethods = false)
public class TestClockConfiguration {

  public static final Instant NOW = Instant.parse("2026-11-17T06:00:00Z");
  public static final ZoneId ZONE = ZoneId.of("Europe/Moscow");

  @Bean
  @Primary
  Clock fixedClock() {
    return Clock.fixed(NOW, ZONE);
  }
}
