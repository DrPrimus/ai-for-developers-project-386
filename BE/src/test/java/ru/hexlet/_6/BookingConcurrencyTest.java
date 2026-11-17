package ru.hexlet._6;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import ru.hexlet._6.store.InMemoryStore;
import ru.hexlet._6.support.TestClockConfiguration;

/**
 * Настоящий HTTP-шов одновременных запросов: несколько потоков одновременно бронируют один слот.
 *
 * <p>Барьер из двух латчей гарантирует, что все участники уже готовы и стартуют вместе, поэтому
 * запросы приходят на сервер почти одновременно. Раундов много: один раунд может пройти случайно,
 * если планировщик сериализует потоки. Инвариант проверяется как «ровно один 201, остальные 409, в
 * хранилище одна встреча», а не как конкретный порядок ответов.
 */
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@Import(TestClockConfiguration.class)
@Timeout(value = 120)
class BookingConcurrencyTest {

  private static final int PARTICIPANTS = 4;
  private static final int ROUNDS = 30;
  private static final String STARTS_AT = "2026-11-18T09:00:00+03:00";

  record CreateMeetingTypeRequestBody(String name, String description, int durationMinutes) {}

  record BookSlotRequestBody(String meetingTypeId, String startsAt) {}

  @Autowired private TestRestTemplate restTemplate;
  @Autowired private InMemoryStore store;

  @Test
  void exactlyOneOfTheSimultaneousRequestsCreatesTheMeeting() throws Exception {
    ExecutorService pool = Executors.newFixedThreadPool(PARTICIPANTS);
    try {
      for (int round = 0; round < ROUNDS; round++) {
        String meetingTypeId = prepareRound();
        CountDownLatch ready = new CountDownLatch(PARTICIPANTS);
        CountDownLatch start = new CountDownLatch(1);

        List<Future<HttpStatusCode>> futures = new ArrayList<>();
        for (int participant = 0; participant < PARTICIPANTS; participant++) {
          futures.add(
              pool.submit(() -> {
                ready.countDown();
                start.await(10, TimeUnit.SECONDS);
                return book(meetingTypeId);
              }));
        }

        assertThat(ready.await(10, TimeUnit.SECONDS))
            .as("раунд %d: все потоки готовы", round)
            .isTrue();
        start.countDown();

        List<HttpStatusCode> statuses = new ArrayList<>();
        for (Future<HttpStatusCode> future : futures) {
          statuses.add(future.get(10, TimeUnit.SECONDS));
        }

        assertThat(statuses.stream().filter(HttpStatus.CREATED::equals).toList())
            .as("раунд %d: ровно один 201", round)
            .hasSize(1);
        assertThat(statuses.stream().filter(HttpStatus.CONFLICT::equals).toList())
            .as("раунд %d: остальные 409", round)
            .hasSize(PARTICIPANTS - 1);
        assertThat(store.meetings()).as("раунд %d: в хранилище одна встреча", round).hasSize(1);
      }
    } finally {
      pool.shutdownNow();
    }
  }

  private String prepareRound() {
    store.clear();
    ResponseEntity<String> response =
        restTemplate.postForEntity(
            "/api/meeting-types",
            new CreateMeetingTypeRequestBody("Встреча", "Описание", 30),
            String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    return JsonPath.read(response.getBody(), "$.id");
  }

  private HttpStatusCode book(String meetingTypeId) {
    return restTemplate
        .postForEntity(
            "/api/meetings", new BookSlotRequestBody(meetingTypeId, STARTS_AT), String.class)
        .getStatusCode();
  }
}
