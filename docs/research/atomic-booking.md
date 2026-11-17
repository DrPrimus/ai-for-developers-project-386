# Атомарное бронирование в памяти: исследование

Статус: research, не решение. Отвечает на вопросы тикета про атомарность проверки пересечений, детерминированные тесты гонки, стартеры Boot 4 и юнит-тесты расчёта слотов.

Термины — по `GLOSSARY.md`: **слот**, **свободный слот**, **пересечение**, **окно бронирования**, **рабочие часы**, **часовой пояс**, **тип встречи**, **встреча**, **бронирование**. Идентификаторы в коде — английские (`Booking`, `Slot`, `tryBook`).

## 0. Что уже есть в репозитории

- `BE/pom.xml`: parent `spring-boot-starter-parent:4.1.2`, `java.version=25`; зависимости — `spring-boot-starter-webmvc`, `spring-boot-starter-webmvc-test` (test), `spring-boot-starter-actuator`, `spring-boot-restclient` (test, «required by TestRestTemplate in actuator tests»).
- Тесты: `BE/src/test/java/ru/hexlet/_6/ActuatorHealthTest.java` (`@SpringBootTest(webEnvironment = RANDOM_PORT)` + `@AutoConfigureTestRestTemplate`, импорт `org.springframework.boot.resttestclient.TestRestTemplate`), `ApplicationTests.java`.
- Слоя хранения нет: только `Application.java` и `application.yaml` (`spring.application.name: 386`).
- Версии в стеке тестов (из `spring-boot-dependencies-4.1.2.pom`): JUnit Jupiter `6.0.3`, AssertJ `3.27.7`, Mockito `5.23.0`, Hibernate Validator `9.1.5.Final`, `jakarta.validation-api` `3.1.1`.
- Java в окружении: OpenJDK 25.0.5 — все примеры ниже проверялись на нём.

Вывод из pom: для валидации нужен **отдельный** стартер, его сейчас нет.

## 1. Как атомарно «проверить пересечения + вставить»

### 1.1. Почему задача не решается одним `ConcurrentHashMap`

Инвариант из README — не «один ключ занят один раз», а «нет пересечений ни с одной встречей»: тип встречи на 60 минут в 09:00 конфликтует с типом на 30 минут в 09:30, то есть проверка смотрит на **много** записей, а не на одну. Javadoc `ConcurrentHashMap.compute` гарантирует атомарность только в рамках одного ключа и прямо предупреждает:

> The entire method invocation is performed atomically. Some attempted update operations on this map by other threads may be blocked while computation is in progress, so the computation should be short and simple. The remapping function must not modify this map during computation.

Отсюда два следствия:

1. `compute(slotKey, ...)` защитит только «ровно этот слот», но не пересечение с другим слотом другого типа. Значит инвариант остаётся негарантированным.
2. Даже если бы ключом был день, `compute` блокирует бакет (bin), а не только «искомый ключ», а внутри нельзя менять ту же map — то есть нельзя вызвать `put` вложенно, это прямой путь к зависанию.

`ConcurrentHashMap` годится как **индекс для чтения**, но не как замок для инварианта «нет пересечений».

### 1.2. Сравнение вариантов

| Вариант | Атомарность «проверить + вставить» | Подводные камни | Вердикт |
|---|---|---|---|
| `synchronized` метод/блок | Да, монитор | Блокировка на весь магазин (включая чтения, если они не отделены); с виртуальными потоками исторически пининг, но в JDK 24+ (`JEP 491`) `synchronized` больше не пинит носитель | Годится, самый простой |
| `ReentrantLock` | Да | Нужен `try/finally`; не забыть `unlock` на всех путях; справедливость (`fair=true`) дороже и почти не нужна | **Рекомендуется** |
| `ConcurrentHashMap.compute` | Только на ключ | Не покрывает пересечения разных ключей; внутри нельзя менять map; долгая работа блокирует бакет | Не для этого инварианта |
| `StampedLock` | Да (write lock) | **Не реентрантный**: «They are not reentrant, so locked bodies should not call other unknown methods that may try to re-acquire locks»; оптимистичное чтение требует `validate` и side-effect-free секции | Избыточен |

Первичные формулировки:

- `ReentrantLock`: «A reentrant mutual exclusion Lock with the same basic behavior and semantics as the implicit monitor lock accessed using `synchronized` methods and statements, but with extended capabilities».
- `Lock` (интерфейс) про дисциплину: `lock()` — последний оператор перед `try`, `unlock()` — первый в `finally`.
- `StampedLock`: «They are not reentrant… The use of read lock modes relies on the associated code sections being side-effect-free».
- Модель памяти: «An unlock (synchronized block or method exit) of a monitor happens-before every subsequent lock… of that same monitor» (`java.util.concurrent` package summary, JLS §17.4.5).

### 1.3. Рекомендация

Один **write-lock на весь магазин встреч** + **volatile-снимок неизменяемого списка для чтений**. Тогда:

- запись: `lock` → прочитать актуальный снимок → проверить пересечения → собрать новый список → `volatile`-присваивание → `unlock`;
- чтение: читает `volatile`-поле, блокировку не берёт, видит целостный снимок (публикация неизменяемого списка через volatile);
- блокировка держится микросекунды, внешних вызовов (JSON, HTTP, логирование с I/O) внутри нет.

Это важно, потому что бин по умолчанию singleton: «Only one shared instance of a singleton bean is managed, and all requests for beans… result in that one specific bean instance» — то есть весь конкурентный доступ к состоянию идёт в один объект, и потокобезопасность целиком на нас.

```java
package ru.hexlet._6.booking;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantLock;

final class BookingStore {

  /** Результат попытки: либо встреча, либо список свободных альтернатив. */
  sealed interface Result permits Result.Booked, Result.Conflict {
    record Booked(Booking booking) implements Result {}

    record Conflict(List<Slot> alternatives) implements Result {}
  }

  private final ReentrantLock lock = new ReentrantLock();
  private final Clock clock;
  private volatile List<Booking> bookings = List.of();

  BookingStore(Clock clock) {
    this.clock = clock;
  }

  Result tryBook(Slot slot, MeetingType type) {
    lock.lock();
    try {
      List<Booking> current = bookings; // снимок под замком
      if (current.stream().anyMatch(b -> overlaps(b.slot(), slot))) {
        List<Slot> occupied = current.stream().map(Booking::slot).toList();
        return new Result.Conflict(freeSlots(occupied, slot.start()));
      }
      Booking booking = new Booking(type, slot);
      List<Booking> next = new ArrayList<>(current);
      next.add(booking);
      bookings = List.copyOf(next); // публикация неизменяемого снимка
      return new Result.Booked(booking);
    } finally {
      lock.unlock();
    }
  }

  List<Booking> bookings() {
    return bookings; // без блокировки, снимок неизменяемый
  }

  /** Полуинтервалы [start, end): конец одной встречи = начало следующей допустима. */
  private static boolean overlaps(Slot a, Slot b) {
    return a.start().isBefore(b.end()) && b.start().isBefore(a.end());
  }

  private List<Slot> freeSlots(List<Slot> occupied, Instant after) {
    // ... расчёт по рабочим часам и окну бронирования, см. раздел 4
    throw new UnsupportedOperationException("sketch");
  }
}
```

Подводные камни, которые здесь закрыты осознанно:

- **Блокировка нескольких структур.** Пока одна структура — одна блокировка, дедлока нет по построению. Как только появится вторая (например, типы встреч отдельно), нужен строгий порядок захвата либо одна общая блокировка. Держать два `ReentrantLock` и захватывать в разном порядке — классический дедлок.
- **Чтение под блокировкой.** Список встреч для владельца и для поиска альтернатив не должен требовать write-lock; иначе чтения сериализуются с записями и растёт latency.
- **Долгая работа под замком.** Расчёт всех слотов окна на 14 дней можно делать **до** захвата; под замком — только проверка и вставка.
- **Возврат внутренностей.** Не отдавать наружу `ArrayList` из поля: только `List.copyOf`/`List.of`.
- **`compute`-искушение.** Не переносить проверку внутрь `ConcurrentHashMap.compute` «для скорости»: инвариант шире ключа.
- **Виртуальные потоки.** Если позже включат `spring.threads.virtual.enabled`, `ReentrantLock` безопасен всегда, а `synchronized` перестал пинить носитель начиная с JDK 24 (`JEP 491`: «arranging for virtual threads that block in such constructs to release their underlying platform threads»).

Альтернатива «на один шаг проще»: `synchronized` на методах того же класса. Она корректна; выбирать её стоит, только если чтения тоже допустимо сериализовать.

## 2. Детерминированный тест одновременных запросов

### 2.1. Чем стрелять: MockMvc vs TestRestTemplate vs RestTestClient

| Инструмент | Что проверяет | Boot 4 импорты | Когда брать |
|---|---|---|---|
| `MockMvc` | Полную обработку Spring MVC, но «via mock request and response objects instead of a running server» | `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc`, `org.springframework.test.web.servlet.MockMvc` | Быстрый тест 409/400-контракта; не поднимает Tomcat |
| `TestRestTemplate` | Реальный HTTP через запущенный сервер | `org.springframework.boot.resttestclient.TestRestTemplate`, `org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate`, `@SpringBootTest(webEnvironment = RANDOM_PORT)` | Сквозной контракт на реальном порту (как в `ActuatorHealthTest`) |
| `RestTestClient` | Fluent/AssertJ, работает и с mock, и с реальным сервером | `org.springframework.boot.resttestclient.autoconfigure.AutoConfigureRestTestClient`, `org.springframework.test.web.servlet.client.RestTestClient` | Если хочется AssertJ-стиля |

Важные факты Boot 4 (не Boot 3):

- `@SpringBootTest` больше не даёт ни `MockMvc`, ни `TestRestTemplate`: «Using the `@SpringBootTest` annotation will no longer provide any MockMVC support… you should now add an `@AutoConfigureMockMvc` annotation»; «will no longer provide any WebClient or TestRestTemplate beans… add an `@AutoConfigureTestRestTemplate` annotation. Dependencies on `spring-boot-resttestclient` and `spring-boot-restclient` are also required».
- Пакет класса сменился: «The package holding that class will also need to be updated to `org.springframework.boot.resttestclient.TestRestTemplate`» — это ровно то, что уже сделано в `ActuatorHealthTest`.
- `MOCK`-режим: «Embedded servers are not started when using this annotation», поэтому конкурентный тест на `MockMvc` не проверяет пул потоков Tomcat — и это плюс: он проверяет именно наш инвариант, без шума контейнера.

**Рекомендация по слоям тестов:**

1. Юнит-тест предиката пересечения и расчёта слотов — детерминированный, без потоков (раздел 4).
2. Тест взаимного исключения на `BookingStore` — реальные потоки, минимальный пул, без Spring (быстро и воспроизводимо).
3. Один интеграционный тест `RANDOM_PORT` + `TestRestTemplate`: два параллельных POST на один слот → ровно один `201`, один `409` с непустыми альтернативами. Это и есть требование README, проверенное по HTTP.

### 2.2. Как получить настоящую гонку

Голый `new Thread(...).start()` не гарантирует одновременность: потоки могут стартовать с разницей в миллисекунды, а критическая секция длится микросекунды — второй поток приходит, когда первый уже всё записал. Канонический приём описан в javadoc `CountDownLatch` («class Driver»): стартовый латч на 1, который считает вниз главный поток, и `doneSignal` на N.

```java
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;

class BookingStoreConcurrencyTest {

  private static final ZoneId ZONE = ZoneId.of("Europe/Moscow");
  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-11-17T06:00:00Z"), ZONE); // 09:00 по Москве

  @Test
  @Timeout(10)
  void onlyOneBookingWinsForTheSameSlot() throws Exception {
    int rounds = 100;
    for (int round = 0; round < rounds; round++) {
      BookingStore store = new BookingStore(CLOCK);
      Slot slot = new Slot(Instant.parse("2026-11-17T06:00:00Z"), Duration.ofMinutes(30));

      int racers = 4; // потоков не больше, чем участников латча!
      ExecutorService pool = Executors.newFixedThreadPool(racers);
      CountDownLatch ready = new CountDownLatch(racers);
      CountDownLatch start = new CountDownLatch(1);

      try {
        List<Future<BookingStore.Result>> futures = new ArrayList<>();
        for (int i = 0; i < racers; i++) {
          futures.add(
              pool.submit(
                  () -> {
                    ready.countDown();
                    start.await();
                    return store.tryBook(slot, MeetingType.CONSULTATION_30);
                  }));
        }
        ready.await(5, TimeUnit.SECONDS); // все потоки стоят на старте
        start.countDown(); // выстрел

        List<BookingStore.Result> results = new ArrayList<>();
        for (Future<BookingStore.Result> f : futures) {
          results.add(f.get(5, TimeUnit.SECONDS));
        }

        long booked = results.stream().filter(r -> r instanceof BookingStore.Result.Booked).count();
        long conflicts =
            results.stream().filter(r -> r instanceof BookingStore.Result.Conflict).count();

        assertThat(booked).isEqualTo(1);
        assertThat(conflicts).isEqualTo(racers - 1);
        assertThat(store.bookings()).hasSize(1);
      } finally {
        pool.shutdownNow();
      }
    }
  }
}
```

Почему так, а не иначе:

- **`ready` + `start`.** Первый латч гарантирует, что все потоки уже в пуле и дождались команды; второй — что команда одна на всех. Без `ready` часть потоков ещё создаётся, когда гонка уже кончилась.
- **Размер пула ≥ числа участников.** `newFixedThreadPool(2)` при `CountDownLatch(4)` даст вечное ожидание `ready.await` — тест зависнет, а не упадёт.
- **Потоки переиспользуются между раундами** (пул создаётся на раунд или на тест) — иначе накладные расходы на создание потока съедят окно гонки.
- **Много раундов.** Один раунд может «пройти случайно»: например, при сломанной блокировке потоки всё равно окажутся сериализованы планировщиком, и `HashMap` не успеет испортиться. 100 раундов дают на порядки больше шансов поймать регресс, но это всё ещё **вероятностный** тест.
- **Инварианты, а не порядок.** Проверяем «ровно один `Booked`, остальные `Conflict`, в магазине одна встреча». Не проверяем, кто именно победил, и не зависим от порядка ответов.
- **Таймауты.** `@Timeout(10)` не даёт зависнуть всему CI; `future.get(5, SECONDS)` не даёт зависнуть на одном future. `@Timeout` по умолчанию работает в `SAME_THREAD` — то есть не прерывает поток, поэтому таймаут на `get` обязателен.
- **Никакого `assertTimeoutPreemptively` вокруг кода под Spring.** JUnit прямо предупреждает: «execute the provided executable or supplier in a different thread… can lead to undesirable side effects if the code… relies on `ThreadLocal` storage», и приводит в пример именно транзакции Spring. Для теста магазина без Spring это не критично, но привычку лучше не заводить.

### 2.3. Как исключить «случайный проход» полностью

Вероятностный тест не доказывает отсутствие гонки — он доказывает только, что при данном планировании её не видно. Полностью детерминированный тест требует **шва внутри критической секции**:

```java
// Продакшн-код: хук по умолчанию пустой, виден только пакету/тестам.
interface CriticalSectionHook {
  void insideCriticalSection();
}

private static final CriticalSectionHook NO_HOOK = () -> {};

Result tryBook(Slot slot, MeetingType type) {
  lock.lock();
  try {
    hook.insideCriticalSection(); // в проде — no-op
    // проверка + вставка
  } finally {
    lock.unlock();
  }
}
```

Тест взаимного исключения тогда выглядит так: поток A входит в секцию и ждёт на латче; поток B вызывает `tryBook` и **обязан** не вернуться, пока A держит замок. Если B вернулся — блокировки нет. Это не зависит от планировщика. Цена — тестовый шов в продакшн-классе; приемлемо, если он package-private и в конструкторе по умолчанию подставляется `NO_HOOK`. Если шов не хочется, честная формулировка в отчёте: «тест вероятностный, корректность обеспечивается ревью и конструкцией (один замок на магазин)».

Практический минимум, который стоит принять в любом случае: **тест предиката пересечения отдельно** (раздел 4) — тогда конкурентный тест проверяет только взаимное исключение, а не логику.

### 2.4. Чего не делать в тесте гонки

- `@Transactional` на тесте: транзакция Spring привязана к потоку, а работа идёт в других потоках — отката не будет (Boot-документация: «the HTTP client and server run in separate threads and, thus, in separate transactions»). Хранилище всё равно в памяти, но привычка опасна.
- Общий `MockMvc` для достижения «настоящей» гонки контейнера: `MOCK`-режим сервер не поднимает, пула Tomcat нет.
- `Thread.sleep` для «синхронизации» вместо латчей — источник флаки.
- Проверка `assertThat(results).hasSize(2)` без проверки типов результатов: два `Conflict` тоже дадут размер 2.

## 3. Стартеры и пакеты Boot 4: валидация, webmvc, тесты

### 3.1. Переименования Boot 3 → Boot 4 (по migration guide)

| Boot 3 | Boot 4 |
|---|---|
| `spring-boot-starter-web` | `spring-boot-starter-webmvc` |
| (не было отдельного) | `spring-boot-starter-webmvc-test` |
| `spring-boot-starter-validation` | `spring-boot-starter-validation` (имя то же) |
| `@AutoConfigureMockMvc` из `org.springframework.boot.test.autoconfigure.web.servlet` | `org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc` |
| `TestRestTemplate` из `org.springframework.boot.test.web.client` | `org.springframework.boot.resttestclient.TestRestTemplate` + `@AutoConfigureTestRestTemplate` |
| `spring-boot-starter-test` (всё в одном) | модульные `*-test` стартеры (`webmvc-test`, `resttestclient`, `validation-test`, …) |

Нюанс: артефакт `spring-boot-starter-web` в 4.1.2 физически ещё существует и тянет те же зависимости, что `webmvc` (`spring-boot-webmvc`, `spring-boot-starter-tomcat`, `spring-boot-http-converter`, `spring-boot-starter-jackson`), но migration guide указывает замену `spring-boot-starter-web` → `spring-boot-starter-webmvc`, и `AGENTS.md` требует имена Boot 4. То есть в новом коде — только `webmvc`.

### 3.2. Валидация

`spring-boot-starter-validation` в 4.1.2 существует и состоит из `spring-boot-starter` + `spring-boot-validation` (модуль авто-конфигурации). Версии заданы в parent: `hibernate-validator 9.1.5.Final`, `jakarta.validation-api 3.1.1`.

Boot-документация: «The method validation feature supported by Bean Validation 1.1 is automatically enabled as long as a JSR-303 implementation (such as Hibernate Validator, typically provided by `spring-boot-starter-validation`) is on the classpath».

**Главный подводный камень:** без этого стартера `@Valid` на `@RequestBody` остаётся аннотацией без эффекта — запрос с пустым названием типа встречи пройдёт в контроллер. Тест «400 на невалидный запрос» без стартера будет падать, и это правильный сигнал.

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

Для тестов валидации есть отдельный `spring-boot-starter-validation-test` (`spring-boot-starter-test` + `spring-boot-starter-validation`); он нужен, только если тестировать `Validator` напрямую, для MVC-тестов достаточно основного стартера.

Использование в контроллере (Spring Framework 7.0): Bean Validation применяется к `@RequestBody`, помеченному `@jakarta.validation.Valid` (или Spring `@Validated`), при условии, что это не контейнер (`Map`/`Collection`) и рядом нет `BindingResult`; при нарушении поднимается `MethodArgumentNotValidException`. Документация также советует обрабатывать и `MethodArgumentNotValidException`, и `HandlerMethodValidationException` — второй прилетит, если ограничения стоят прямо на параметрах метода.

```java
record CreateMeetingTypeRequest(
    @NotBlank String name,
    @NotNull @Positive Integer durationMinutes) {}

@PostMapping("/api/meeting-types")
ResponseEntity<Void> create(@Valid @RequestBody CreateMeetingTypeRequest request) { ... }
```

Ожидаемый статус при нарушении — `400` (Spring MVC обрабатывает `MethodArgumentNotValidException` через `ResponseEntityExceptionHandler`); `409` — только для занятого слота, это разные ветки.

### 3.3. Что уже покрыто pom, а что добавить

- `spring-boot-starter-webmvc` — MVC + Tomcat + Jackson. Достаточно.
- `spring-boot-starter-webmvc-test` — тянет `spring-boot-test`, `spring-boot-webmvc-test`, `spring-boot-resttestclient`, `spring-boot-starter-jackson-test`; даёт `MockMvc`, `MockMvcTester`, `RestTestClient`.
- `spring-boot-restclient` (test) — `RestTemplateBuilder`/`RestTemplate` для `TestRestTemplate`; комментарий в pom и migration guide сходятся: нужны оба артефакта.
- Добавить: `spring-boot-starter-validation` (compile). Больше для описанных требований ничего не нужно — БД и внешние сервисы не требуются.

Для HTTP-теста на 409 `TestRestTemplate` удобен своей «fault-tolerant» природой: «4xx and 5xx do not result in an exception being thrown and can instead be detected through the response entity and its status code» — то есть `409` читается как обычный `ResponseEntity`, без `try/catch`.

## 4. Юнит-тесты расчёта слотов

### 4.1. Инъекция `Clock` — по документации JDK

`Clock` javadoc: «Best practice for applications is to pass a Clock into any method that requires the current instant and time-zone. A dependency injection framework is one way to achieve this». Дальше — стандартный бин:

```java
@Configuration
class TimeConfiguration {

  @Bean
  Clock clock() {
    return Clock.system(ZoneId.of("Europe/Moscow"));
  }

  @Bean
  ZoneId bookingZone() {
    return ZoneId.of("Europe/Moscow");
  }
}
```

В тестах — `Clock.fixed` и `@TestConfiguration`/`@Primary`, либо прямой конструктор без Spring (быстрее). `Clock.fixed` возвращает неизменяемый потокобезопасный экземпляр, поэтому один и тот же бин безопасно использовать из параллельных тестов.

Ключевое: `LocalDate.now(clock)`, `clock.instant()`, `ZonedDateTime.now(clock)` — и ни одного `Instant.now()`/`LocalDate.now()` без аргумента в продакшн-коде расчёта. Иначе «сегодня» в тесте не зафиксировать, и тест на границу окна бронирования будет флакать в полночь.

### 4.2. Модель времени

- Рабочие часы и часовой пояс — константы (`LocalTime.of(9, 0)`, `LocalTime.of(18, 0)`, `ZoneId.of("Europe/Moscow")`), а не настройки из env: README фиксирует их как константы.
- Слот — полуинтервал `[start, end)`. Тогда «конец одной встречи = начало следующей» выполняется без специального случая, а предикат пересечения ровно один: `aStart < bEnd && bStart < aEnd`.
- Границы дня строить через `LocalDate.atTime(...).atZone(zone)`, а длительность прибавлять к `ZonedDateTime`: javadoc `plusMinutes` — «This operates on the instant time-line, such that adding one minute will always be a duration of one minute later. This may cause the local date-time to change by an amount other than one minute. Note that this is a different approach to that used by days, months and years». Для длительности встречи это именно то, что нужно.

### 4.3. Часовой пояс: проверенный факт и как его закрепить тестом

Проверено на OpenJDK 25.0.5 (jshell, `ZoneId.of("Europe/Moscow").getRules()`):

- `getTransitionRules()` → `[]`, `nextTransition(2026-11-17T00:00Z)` → `null` — в обозримом будущем перехода на летнее время нет, все дни окна бронирования имеют смещение `+03:00`;
- `isFixedOffset()` → **`false`** (у зоны есть исторические переходы в tzdata), поэтому **не** стоит писать `assertThat(rules.isFixedOffset()).isTrue()` — тест упадёт не по делу.

Если хочется зафиксировать предположение «в окне нет переходов», проверять надо отсутствие переходов, а не «фиксированность»:

```java
@Test
void moscowHasNoDstTransitionInBookingWindow() {
  ZoneRules rules = ZoneId.of("Europe/Moscow").getRules();
  Instant windowStart = Instant.parse("2026-11-17T06:00:00Z");
  assertThat(rules.nextTransition(windowStart)).isNull();
}
```

Общая причина такого теста — javadoc `ZonedDateTime`: локальное время может попадать в **gap** (ноль валидных смещений) или **overlap** (два смещения). Для Europe/Moscow сейчас это не так, но код не должен на это молча полагаться: если зону когда-нибудь заменят на другую, тест об этом скажет.

### 4.4. Таблица граничных случаев

Константы: рабочие часы 09:00–18:00, тип встречи 30 минут, окно 14 дней, `Europe/Moscow`, «сейчас» = 2026-11-17T09:00+03:00.

| Случай | Вход | Ожидание |
|---|---|---|
| Начало дня | 09:00–09:30 | Свободный слот |
| Чуть раньше открытия | 08:30–09:00 | Не слот: начало вне рабочих часов |
| Конец дня ровно в закрытие | 17:30–18:00 | Свободный слот |
| Выход за закрытие | 17:45–18:15 | Не слот |
| Последний возможный старт | 17:30 (при 30 мин) | Есть; 18:00 — уже нет |
| Стык | 09:00–09:30 занято, бронь 09:30–10:00 | Разрешено (конец = начало) |
| Пересечение на 1 минуту | 09:00–09:30 занято, бронь 09:15–09:45 | Запрещено |
| Полное покрытие | 09:00–10:00 занято, бронь 09:15–09:30 | Запрещено |
| Цепочка с шагом длительности | тип 30 мин: 09:00, 09:30, 10:00… | Старты кратны 30 минутам от 09:00 |
| Тип 90 минут | 09:00–10:30, затем 10:30–12:00 | Старты кратны 90 минутам |
| Окно бронирования | сегодня + 13 дней в 17:30; +14 дней | Первое есть, второе — вне окна |
| Прошлое | 09:00 при «сейчас» 10:00 | Не слот |
| Смещение UTC | `Instant` 06:00Z | Локально 09:00+03:00 |

### 4.5. Пример юнит-теста расчёта

```java
class SlotCalculatorTest {

  private static final ZoneId ZONE = ZoneId.of("Europe/Moscow");
  private static final Clock CLOCK =
      Clock.fixed(Instant.parse("2026-11-17T06:00:00Z"), ZONE); // 09:00 MSK
  private static final LocalTime OPEN = LocalTime.of(9, 0);
  private static final LocalTime CLOSE = LocalTime.of(18, 0);

  private final SlotCalculator calculator =
      new SlotCalculator(CLOCK, ZONE, OPEN, CLOSE, Duration.ofDays(14));

  @Test
  void lastSlotEndsExactlyAtClosingTime() {
    List<Slot> slots = calculator.freeSlots(Duration.ofMinutes(30), List.of());

    Slot last = slots.get(slots.size() - 1);
    assertThat(last.end()).isEqualTo(Instant.parse("2026-11-17T15:00:00Z")); // 18:00 MSK
  }

  @Test
  void slotCannotStartBeforeOpening() {
    assertThat(calculator.freeSlots(Duration.ofMinutes(30), List.of()))
        .allSatisfy(s -> assertThat(s.start()).isAfterOrEqualTo(Instant.parse("2026-11-17T06:00:00Z")));
  }

  @Test
  void backToBackMeetingsDoNotOverlap() {
    Slot busy = new Slot(Instant.parse("2026-11-17T06:00:00Z"), Duration.ofMinutes(30));

    List<Slot> free = calculator.freeSlots(Duration.ofMinutes(30), List.of(busy));

    assertThat(free).contains(new Slot(Instant.parse("2026-11-17T06:30:00Z"), Duration.ofMinutes(30)));
    assertThat(free).doesNotContain(busy);
  }

  @Test
  void sixtyMinuteTypeStepsBySixtyMinutes() {
    List<Slot> slots = calculator.freeSlots(Duration.ofMinutes(60), List.of());

    assertThat(slots.get(0).start()).isEqualTo(Instant.parse("2026-11-17T06:00:00Z"));
    assertThat(slots.get(1).start()).isEqualTo(Instant.parse("2026-11-17T07:00:00Z"));
  }
}
```

Тест на пересечение — отдельный, чистый и без `Clock`, потому что это чистая функция:

```java
@Test
void adjacentIntervalsDoNotOverlapButOneMinuteOverlapDoes() {
  Slot first = new Slot(Instant.parse("2026-11-17T06:00:00Z"), Duration.ofMinutes(30));

  assertThat(overlaps(first, new Slot(first.end(), Duration.ofMinutes(30)))).isFalse();
  assertThat(overlaps(first, new Slot(first.start().plusSeconds(60), Duration.ofMinutes(30)))).isTrue();
  assertThat(overlaps(first, new Slot(first.start().minusSeconds(60), Duration.ofMinutes(30)))).isTrue();
}
```

Замечания по стилю тестов:

- Проверять `Instant`/`ZonedDateTime`, а не строки: сравнение строк скрывает ошибки смещения.
- Для «сейчас» в разных сценариях — свой `Clock.fixed` на тест, а не общий мутабельный.
- Не использовать `LocalDate.now()` в ассертах — иначе тест зависит от даты запуска.
- Окно бронирования проверять от `LocalDate.now(clock)`; на границе суток тест должен давать один и тот же результат при любом времени запуска — это и есть причина фиксировать `Clock`.

## 5. Итоговая рекомендация

1. **Хранение:** один `BookingStore`-бин, `ReentrantLock` вокруг «проверить пересечения + вставить», `volatile List` неизменяемых снимков для чтений. `ConcurrentHashMap.compute` — нет (инвариант шире ключа), `StampedLock` — нет (избыточен и не реентрантен).
2. **API бронирования:** один метод, возвращающий `Booked(Booking)` либо `Conflict(List<Slot>)`; контроллер переводит `Conflict` в `409` + альтернативы, `Booked` — в `201`.
3. **Тесты:** предикат пересечения и расчёт слотов — чистые юнит-тесты с `Clock.fixed`; взаимное исключение — реальные потоки с `ready`/`start` латчами, 100 раундов, размер пула ≥ числа участников; контракт `201`/`409` — `RANDOM_PORT` + `TestRestTemplate`. Для полной детерминированности — package-private хук внутри критической секции.
4. **Стартеры:** добавить `spring-boot-starter-validation`; имена Boot 4 (`webmvc`, `webmvc-test`, `resttestclient`), без `starter-web` и без старых пакетов `org.springframework.boot.test.autoconfigure.web.servlet`.

## Источники

### Локальные (первичные для проекта)

- `BE/pom.xml` — версия parent 4.1.2, Java 25, набор стартеров.
- `BE/src/test/java/ru/hexlet/_6/ActuatorHealthTest.java` — рабочий пример Boot 4-импортов `TestRestTemplate`/`@AutoConfigureTestRestTemplate`.
- `README.md` — сценарии, 14 дней, рабочие часы, правила пересечения и одновременных запросов.
- `GLOSSARY.md` — термины (слот, свободный слот, пересечение, окно бронирования).
- `~/.m2/.../spring-boot-dependencies-4.1.2.pom` — JUnit Jupiter 6.0.3, AssertJ 3.27.7, Hibernate Validator 9.1.5, `jakarta.validation-api` 3.1.1, наличие `spring-boot-starter-validation` и `spring-boot-starter-validation-test`.

### Java SE 25 / JDK

- `ConcurrentHashMap`: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ConcurrentHashMap.html
- `java.util.concurrent` package summary (Memory Consistency Properties): https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/package-summary.html
- `ReentrantLock`: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/ReentrantLock.html
- `Lock` (дисциплина `try/finally`): https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/Lock.html
- `StampedLock` (не реентрантный, optimistic read): https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/locks/StampedLock.html
- `CountDownLatch` (пример `startSignal`/`doneSignal`): https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/CountDownLatch.html
- `Clock` (инъекция, thread-safe реализации): https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/Clock.html
- `ZonedDateTime` (instant time-line, gap/overlap): https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/ZonedDateTime.html
- `ZoneId` / `ZoneRules`: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/ZoneId.html , https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/time/zone/ZoneRules.html
- JLS SE 25, §17.4.5 Happens-before Order: https://docs.oracle.com/javase/specs/jls/se25/html/jls-17.html
- JEP 491: Synchronize Virtual Threads without Pinning (JDK 24): https://openjdk.org/jeps/491

### JUnit 6.0.3 (версия из Boot 4.1.2)

- User guide, Timeouts (`@Timeout`, thread modes): https://docs.junit.org/6.0.3/writing-tests/timeouts.html
- User guide, Assertions (`assertTimeoutPreemptively`, предупреждение про `ThreadLocal`): https://docs.junit.org/6.0.3/writing-tests/assertions.html
- User guide, Parallel Execution (по умолчанию `SAME_THREAD`, opt-in): https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html

### Spring Boot 4.1.2

- Testing Spring Boot Applications (`MOCK` не поднимает сервер, `RANDOM_PORT`, новые импорты): https://docs.spring.io/spring-boot/4.1/reference/testing/spring-boot-applications.html
- Test Utilities (`TestRestTemplate` из `spring-boot-resttestclient`, нужен `spring-boot-restclient`, рекомендация `RestTestClient`): https://docs.spring.io/spring-boot/4.1/reference/testing/test-utilities.html
- Validation (`spring-boot-starter-validation`, Bean Validation 1.1, `@Validated`): https://docs.spring.io/spring-boot/4.1/reference/io/validation.html
- Task Execution and Scheduling (`spring.threads.virtual.enabled`): https://docs.spring.io/spring-boot/4.1/reference/features/task-execution-and-scheduling.html
- Javadoc `TestRestTemplate` («fault-tolerant», 4xx/5xx без исключений): https://docs.spring.io/spring-boot/4.1.2/api/java/org/springframework/boot/resttestclient/TestRestTemplate.html
- Spring Boot 4.0 Migration Guide (переименование стартеров, `@AutoConfigureMockMvc`, `@AutoConfigureTestRestTemplate`, пакет `org.springframework.boot.resttestclient`): https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide
- POM-ы артефактов (состав стартеров): https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-webmvc/4.1.2/ , https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-webmvc-test/4.1.2/ , https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-starter-validation/4.1.2/

### Spring Framework 7.0

- MockMvc («via mock request and response objects instead of a running server»): https://docs.spring.io/spring-framework/reference/7.0/testing/mockmvc.html
- MVC, Validation (`@Valid` на `@RequestBody`, `MethodArgumentNotValidException`, `HandlerMethodValidationException`): https://docs.spring.io/spring-framework/reference/7.0/web/webmvc/mvc-controller/ann-validation.html
- Bean scopes, Singleton Scope: https://docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html
