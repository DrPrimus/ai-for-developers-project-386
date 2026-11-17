package ru.hexlet._6;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import org.springframework.test.web.servlet.MvcResult;
import ru.hexlet._6.store.InMemoryStore;
import ru.hexlet._6.support.TestClockConfiguration;

/**
 * HTTP-шов расчёта свободных слотов. Часы зафиксированы на вторник 17 ноября 2026, 09:00 MSK,
 * поэтому окно — 17–30 ноября 2026, а выходные — 21, 22, 28 и 29 ноября.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfiguration.class)
class SlotApiTest {

  private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
  private static final String WEDNESDAY = "2026-11-18";

  @Autowired private MockMvc mockMvc;
  @Autowired private InMemoryStore store;

  @BeforeEach
  void clearStore() {
    store.clear();
  }

  @Test
  void responseContainsFourteenDaysIncludingWeekendsAndTheWindow() throws Exception {
    String typeId = createMeetingType(30);

    mockMvc
        .perform(get("/api/meeting-types/{id}/slots", typeId))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.timeZone").value("Europe/Moscow"))
        .andExpect(jsonPath("$.window.from").value("2026-11-17"))
        .andExpect(jsonPath("$.window.to").value("2026-11-30"))
        .andExpect(jsonPath("$.days.length()").value(14))
        .andExpect(jsonPath("$.days[0].date").value("2026-11-17"))
        .andExpect(jsonPath("$.days[13].date").value("2026-11-30"))
        .andExpect(jsonPath("$.days[4].date").value("2026-11-21"))
        .andExpect(jsonPath("$.days[4].slots.length()").value(0))
        .andExpect(jsonPath("$.days[5].date").value("2026-11-22"))
        .andExpect(jsonPath("$.days[5].slots.length()").value(0))
        .andExpect(jsonPath("$.days[11].date").value("2026-11-28"))
        .andExpect(jsonPath("$.days[11].slots.length()").value(0))
        .andExpect(jsonPath("$.days[12].date").value("2026-11-29"))
        .andExpect(jsonPath("$.days[12].slots.length()").value(0));
  }

  @Test
  void thirtyMinuteTypeFormsAChainAcrossTheWholeWorkingDay() throws Exception {
    String typeId = createMeetingType(30);

    List<String> starts = slotStarts(typeId, WEDNESDAY);

    assertThat(starts)
        .containsExactly(
            "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00",
            "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30");
    assertThat(slotEnds(typeId, WEDNESDAY)).contains("17:30", "18:00");
  }

  @Test
  void sixtyMinuteTypeFormsAChainWithHourStep() throws Exception {
    String typeId = createMeetingType(60);

    assertThat(slotStarts(typeId, WEDNESDAY))
        .containsExactly(
            "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00");
  }

  @Test
  void ninetyMinuteTypeFitsOnlyFullSlotsUpToTheEndOfTheDay() throws Exception {
    String typeId = createMeetingType(90);

    assertThat(slotStarts(typeId, WEDNESDAY))
        .containsExactly("09:00", "10:30", "12:00", "13:30", "15:00", "16:30");
  }

  @Test
  void pastSlotsOfTodayAreHiddenWithoutMinimumLeadTime() throws Exception {
    String typeId = createMeetingType(30);

    List<String> starts = slotStarts(typeId, "2026-11-17");

    assertThat(starts).doesNotContain("09:00");
    assertThat(starts).startsWith("09:30", "10:00").endsWith("17:30");
    assertThat(starts).hasSize(17);
  }

  @Test
  void fiveMinuteTypeTodayStartsWithTheNearestUpcomingSlot() throws Exception {
    String typeId = createMeetingType(5);

    assertThat(slotStarts(typeId, "2026-11-17")).startsWith("09:05", "09:10");
  }

  @Test
  void bookedMeetingSplitsTheChainAndNextSlotStartsAtItsEnd() throws Exception {
    String typeId = createMeetingType(30);
    addMeeting(typeId, 30, "2026-11-18T10:15:00+03:00");

    List<String> starts = slotStarts(typeId, WEDNESDAY);

    assertThat(starts)
        .startsWith("09:00", "09:30")
        .doesNotContain("10:00", "10:30")
        .contains("10:45", "11:15");
  }

  @Test
  void meetingEndingAtClosingTimeLeavesNoSlotsAfterIt() throws Exception {
    String typeId = createMeetingType(30);
    addMeeting(typeId, 60, "2026-11-18T17:00:00+03:00");

    List<String> starts = slotStarts(typeId, WEDNESDAY);

    assertThat(starts).endsWith("16:30").doesNotContain("17:00", "17:30");
  }

  @Test
  void remainderShorterThanTheSlotDurationProducesNoSlot() throws Exception {
    String typeId = createMeetingType(30);
    addMeeting(typeId, 15, "2026-11-18T17:45:00+03:00");

    List<String> starts = slotStarts(typeId, WEDNESDAY);

    assertThat(starts).endsWith("17:00").doesNotContain("17:30");
  }

  @Test
  void unknownMeetingTypeReturnsNotFound() throws Exception {
    mockMvc
        .perform(get("/api/meeting-types/{id}/slots", "00000000-0000-0000-0000-000000000000"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("MEETING_TYPE_NOT_FOUND"));
  }

  @Test
  void malformedMeetingTypeIdReturnsNotFound() throws Exception {
    mockMvc
        .perform(get("/api/meeting-types/not-a-uuid/slots"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("MEETING_TYPE_NOT_FOUND"));
  }

  @Test
  void meetingsOfAnyMeetingTypeBlockTheTime() throws Exception {
    String typeId = createMeetingType(30);
    String otherTypeId = createMeetingType(30);
    addMeeting(otherTypeId, 30, "2026-11-18T09:00:00+03:00");

    assertThat(slotStarts(typeId, WEDNESDAY)).startsWith("09:30", "10:00").doesNotContain("09:00");
  }

  private String createMeetingType(int durationMinutes) throws Exception {
    MvcResult result =
        mockMvc
            .perform(
                post("/api/meeting-types")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {"name": "Встреча", "description": "Описание", "durationMinutes": %d}
                        """
                            .formatted(durationMinutes)))
            .andExpect(status().isCreated())
            .andReturn();
    return JsonPath.read(result.getResponse().getContentAsString(), "$.id");
  }

  private void addMeeting(String meetingTypeId, int durationMinutes, String startsAt) {
    Instant start = OffsetDateTime.parse(startsAt).toInstant();
    store.createMeeting(
        UUID.fromString(meetingTypeId),
        durationMinutes,
        start,
        start.plusSeconds(60L * durationMinutes));
  }

  private String slotsJson(String typeId) throws Exception {
    return mockMvc
        .perform(get("/api/meeting-types/{id}/slots", typeId))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  @SuppressWarnings("unchecked")
  private List<Map<String, String>> slotsOf(String typeId, String date) throws Exception {
    List<Map<String, Object>> days = JsonPath.read(slotsJson(typeId), "$.days");
    Map<String, Object> day =
        days.stream()
            .filter(candidate -> date.equals(candidate.get("date")))
            .findFirst()
            .orElseThrow(() -> new AssertionError("В окне нет дня " + date));
    return (List<Map<String, String>>) day.get("slots");
  }

  private List<String> slotStarts(String typeId, String date) throws Exception {
    return slotsOf(typeId, date).stream()
        .map(slot -> OffsetDateTime.parse(slot.get("startsAt")).format(TIME))
        .toList();
  }

  private List<String> slotEnds(String typeId, String date) throws Exception {
    return slotsOf(typeId, date).stream()
        .map(slot -> OffsetDateTime.parse(slot.get("endsAt")).format(TIME))
        .toList();
  }
}
