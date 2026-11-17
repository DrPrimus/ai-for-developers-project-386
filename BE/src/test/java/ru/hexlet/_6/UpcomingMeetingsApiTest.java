package ru.hexlet._6;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import ru.hexlet._6.store.InMemoryStore;
import ru.hexlet._6.support.TestClockConfiguration;

/**
 * HTTP-шов списка предстоящих встреч. Часы зафиксированы на вторник 17 ноября 2026, 09:00 MSK: окно
 * — 17–30 ноября, встречи начинаются строго позже текущего момента.
 *
 * <p>Прошедшие и выходящие за окно встречи нельзя создать бронированием, поэтому подготовка идёт
 * через хранилище; всё, что проверяется, читается HTTP-запросом.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfiguration.class)
class UpcomingMeetingsApiTest {

  private static final String TYPE_NAME = "Консультация";

  @Autowired private MockMvc mockMvc;
  @Autowired private InMemoryStore store;

  private UUID meetingTypeId;

  @BeforeEach
  void clearStore() throws Exception {
    store.clear();
    meetingTypeId = UUID.fromString(createMeetingType());
  }

  @Test
  void emptyListContainsTimeZoneAndWindow() throws Exception {
    String body = upcoming();

    assertThat((String) JsonPath.read(body, "$.timeZone")).isEqualTo("Europe/Moscow");
    assertThat((String) JsonPath.read(body, "$.window.from")).isEqualTo("2026-11-17");
    assertThat((String) JsonPath.read(body, "$.window.to")).isEqualTo("2026-11-30");
    assertThat(upcomingItems(body)).isEmpty();
  }

  @Test
  void meetingsThatAlreadyStartedAreExcluded() throws Exception {
    insertMeeting("2026-11-17T08:30:00+03:00", 30);
    insertMeeting("2026-11-17T09:00:00+03:00", 30);
    insertMeeting("2026-11-18T09:00:00+03:00", 30);

    assertThat(startTimes(upcoming())).containsExactly("2026-11-18T09:00:00+03:00");
  }

  @Test
  void meetingsOutsideTheBookingWindowAreExcluded() throws Exception {
    insertMeeting("2026-11-16T09:00:00+03:00", 30);
    insertMeeting("2026-11-30T17:30:00+03:00", 30);
    insertMeeting("2026-12-01T09:00:00+03:00", 30);

    assertThat(startTimes(upcoming())).containsExactly("2026-11-30T17:30:00+03:00");
  }

  @Test
  void meetingsAreSortedByStartAscending() throws Exception {
    insertMeeting("2026-11-30T17:30:00+03:00", 30);
    insertMeeting("2026-11-17T10:00:00+03:00", 30);
    insertMeeting("2026-11-18T09:00:00+03:00", 30);

    assertThat(startTimes(upcoming()))
        .containsExactly(
            "2026-11-17T10:00:00+03:00", "2026-11-18T09:00:00+03:00", "2026-11-30T17:30:00+03:00");
  }

  @Test
  void eachMeetingCarriesItsTypeSummaryAndInterval() throws Exception {
    insertMeeting("2026-11-18T09:00:00+03:00", 30);

    Map<String, Object> meeting = upcomingItems(upcoming()).get(0);

    assertThat((String) meeting.get("id")).isNotBlank();
    @SuppressWarnings("unchecked")
    Map<String, Object> summary = (Map<String, Object>) meeting.get("meetingType");
    assertThat((String) summary.get("id")).isEqualTo(meetingTypeId.toString());
    assertThat((String) summary.get("name")).isEqualTo(TYPE_NAME);
    assertThat((Integer) summary.get("durationMinutes")).isEqualTo(30);
    assertThat(OffsetDateTime.parse((String) meeting.get("startsAt")))
        .isEqualTo(OffsetDateTime.parse("2026-11-18T09:00:00+03:00"));
    assertThat(OffsetDateTime.parse((String) meeting.get("endsAt")))
        .isEqualTo(OffsetDateTime.parse("2026-11-18T09:30:00+03:00"));
  }

  @Test
  void bookingAppearsInTheUpcomingList() throws Exception {
    mockMvc
        .perform(
            post("/api/meetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"meetingTypeId": "%s", "startsAt": "2026-11-18T09:00:00+03:00"}
                    """
                        .formatted(meetingTypeId)))
        .andExpect(status().isCreated());

    assertThat(startTimes(upcoming())).containsExactly("2026-11-18T09:00:00+03:00");
  }

  private void insertMeeting(String startsAt, int durationMinutes) {
    Instant start = OffsetDateTime.parse(startsAt).toInstant();
    store.createMeeting(
        meetingTypeId, durationMinutes, start, start.plusSeconds(durationMinutes * 60L));
  }

  private String upcoming() throws Exception {
    return mockMvc
        .perform(get("/api/meetings/upcoming"))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> upcomingItems(String body) {
    return JsonPath.read(body, "$.items");
  }

  private static final DateTimeFormatter SECOND_PRECISION =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX");

  private static List<String> startTimes(String body) {
    return upcomingItems(body).stream()
        .map(meeting ->
            OffsetDateTime.parse((String) meeting.get("startsAt")).format(SECOND_PRECISION))
        .toList();
  }

  private String createMeetingType() throws Exception {
    String body =
        mockMvc
            .perform(
                post("/api/meeting-types")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name": "%s", "description": "Разбор задачи", "durationMinutes": 30}
                        """
                            .formatted(TYPE_NAME)))
            .andExpect(status().isCreated())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return JsonPath.read(body, "$.id");
  }
}
