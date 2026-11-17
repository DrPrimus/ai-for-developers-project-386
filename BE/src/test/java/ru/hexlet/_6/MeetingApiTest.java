package ru.hexlet._6;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
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
 * HTTP-шов бронирования. Часы зафиксированы на вторник 17 ноября 2026, 09:00 MSK: окно — 17–30
 * ноября, выходные — 21, 22, 28 и 29 ноября, сегодняшний 09:00 уже прошёл.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfiguration.class)
class MeetingApiTest {

  private static final DateTimeFormatter TIME = DateTimeFormatter.ofPattern("HH:mm");
  private static final String WEDNESDAY = "2026-11-18";

  @Autowired private MockMvc mockMvc;
  @Autowired private InMemoryStore store;

  @BeforeEach
  void clearStore() {
    store.clear();
  }

  @Test
  void bookingCreatesMeetingWithTypeStartAndEnd() throws Exception {
    String typeId = createMeetingType(30);

    MvcResult result = book(typeId, WEDNESDAY + "T09:00:00+03:00");

    assertThat(result.getResponse().getStatus()).isEqualTo(201);
    String body = result.getResponse().getContentAsString();
    assertThat((String) JsonPath.read(body, "$.id")).isNotBlank();
    assertThat((String) JsonPath.read(body, "$.meetingType.id")).isEqualTo(typeId);
    assertThat((String) JsonPath.read(body, "$.meetingType.name")).isEqualTo("Встреча");
    assertThat((Integer) JsonPath.read(body, "$.meetingType.durationMinutes")).isEqualTo(30);
    assertThat(OffsetDateTime.parse(JsonPath.read(body, "$.startsAt")))
        .isEqualTo(OffsetDateTime.parse(WEDNESDAY + "T09:00:00+03:00"));
    assertThat(OffsetDateTime.parse(JsonPath.read(body, "$.endsAt")))
        .isEqualTo(OffsetDateTime.parse(WEDNESDAY + "T09:30:00+03:00"));
    assertThat(store.meetings()).hasSize(1);
  }

  @Test
  void bookedSlotDisappearsFromTheCalendar() throws Exception {
    String typeId = createMeetingType(30);

    book(typeId, WEDNESDAY + "T09:00:00+03:00");

    assertThat(slotStarts(typeId, WEDNESDAY)).startsWith("09:30", "10:00").doesNotContain("09:00");
  }

  @Test
  void unknownMeetingTypeIsRejectedBeforeTimeIsChecked() throws Exception {
    MvcResult result = book("00000000-0000-0000-0000-000000000000", "2026-11-21T09:00:00+03:00");

    assertThat(result.getResponse().getStatus()).isEqualTo(404);
    assertThat((String) JsonPath.read(result.getResponse().getContentAsString(), "$.code"))
        .isEqualTo("MEETING_TYPE_NOT_FOUND");
    assertThat(store.meetings()).isEmpty();
  }

  @Test
  void malformedMeetingTypeIdIsReportedAsValidationError() throws Exception {
    MvcResult result = book("not-a-uuid", WEDNESDAY + "T09:00:00+03:00");

    assertThat(result.getResponse().getStatus()).isEqualTo(400);
    String body = result.getResponse().getContentAsString();
    assertThat((String) JsonPath.read(body, "$.code")).isEqualTo("VALIDATION_FAILED");
    List<String> fields = JsonPath.read(body, "$.fieldErrors[*].field");
    assertThat(fields).containsExactly("meetingTypeId");
    assertThat(store.meetings()).isEmpty();
  }

  @Test
  void missingFieldsAreReportedAsValidationErrors() throws Exception {
    MvcResult result =
        mockMvc
            .perform(post("/api/meetings").contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
            .andExpect(
                jsonPath("$.fieldErrors[*].field", containsInAnyOrder("meetingTypeId", "startsAt")))
            .andReturn();

    assertThat(result.getResponse().getStatus()).isEqualTo(400);
  }

  @Test
  void missingStartIsReportedAsValidationError() throws Exception {
    String typeId = createMeetingType(30);

    mockMvc
        .perform(
            post("/api/meetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"meetingTypeId\": \"" + typeId + "\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("startsAt")));
  }

  @Test
  void unreadableStartIsReportedAsValidationError() throws Exception {
    String typeId = createMeetingType(30);

    mockMvc
        .perform(
            post("/api/meetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"meetingTypeId": "%s", "startsAt": "завтра в девять"}
                    """
                        .formatted(typeId)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.fieldErrors[*].field", hasItem("startsAt")));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "2026-12-01T09:00:00+03:00", // сегодня + 14 дней: вне окна
        "2026-11-21T09:00:00+03:00", // суббота
        "2026-11-18T08:30:00+03:00", // раньше открытия
        "2026-11-18T17:45:00+03:00", // конец позже 18:00
        "2026-11-17T09:00:00+03:00", // не строго позже текущего момента
        "2026-11-18T09:10:00+03:00", // не начало свободного слота цепочки
        "2026-11-18T12:20:00+03:00" // середина свободного интервала
      })
  void structurallyInvalidSlotIsRejectedWithInvalidSlot(String startsAt) throws Exception {
    String typeId = createMeetingType(30);

    MvcResult result = book(typeId, startsAt);

    assertThat(result.getResponse().getStatus()).isEqualTo(400);
    assertThat((String) JsonPath.read(result.getResponse().getContentAsString(), "$.code"))
        .isEqualTo("INVALID_SLOT");
    assertThat(store.meetings()).isEmpty();
  }

  @ParameterizedTest
  @ValueSource(strings = {"2026-11-18T09:00:00+03:00", "2026-11-30T17:30:00+03:00"})
  void boundarySlotsOfTheWindowAreBookable(String startsAt) throws Exception {
    String typeId = createMeetingType(30);

    assertThat(book(typeId, startsAt).getResponse().getStatus()).isEqualTo(201);
  }

  @Test
  void overlappingSlotReturnsConflictWithAlternativesOfTheSameDay() throws Exception {
    String typeId = createMeetingType(30);
    assertThat(book(typeId, WEDNESDAY + "T09:00:00+03:00").getResponse().getStatus())
        .isEqualTo(201);

    MvcResult conflict = book(typeId, WEDNESDAY + "T09:00:00+03:00");

    assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
    String body = conflict.getResponse().getContentAsString();
    assertThat((String) JsonPath.read(body, "$.code")).isEqualTo("SLOT_TAKEN");
    assertThat((String) JsonPath.read(body, "$.date")).isEqualTo(WEDNESDAY);
    assertThat(conflictSlotStarts(conflict)).doesNotContain("09:00").contains("09:30", "10:00");
    assertThat(store.meetings()).hasSize(1);
  }

  @Test
  void overlapIsReportedEvenWhenTheStartIsNotAChainStart() throws Exception {
    String typeId = createMeetingType(30);
    book(typeId, WEDNESDAY + "T09:00:00+03:00");

    MvcResult conflict = book(typeId, WEDNESDAY + "T09:15:00+03:00");

    assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
    assertThat((String) JsonPath.read(conflict.getResponse().getContentAsString(), "$.code"))
        .isEqualTo("SLOT_TAKEN");
    assertThat(store.meetings()).hasSize(1);
  }

  @Test
  void conflictIsCheckedAgainstMeetingsOfAnyType() throws Exception {
    String hourly = createMeetingType(60);
    String halfHourly = createMeetingType(30);
    book(hourly, WEDNESDAY + "T09:00:00+03:00");

    MvcResult conflict = book(halfHourly, WEDNESDAY + "T09:30:00+03:00");

    assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
    assertThat(store.meetings()).hasSize(1);
  }

  @Test
  void nextMeetingIsBookedWhenItStartsAsThePreviousEnds() throws Exception {
    String typeId = createMeetingType(30);
    book(typeId, WEDNESDAY + "T09:00:00+03:00");

    MvcResult result = book(typeId, WEDNESDAY + "T09:30:00+03:00");

    assertThat(result.getResponse().getStatus()).isEqualTo(201);
    assertThat(store.meetings()).hasSize(2);
  }

  @Test
  void conflictWithoutFreeSlotsReturnsEmptyAlternatives() throws Exception {
    String typeId = createMeetingType(480);
    book(typeId, WEDNESDAY + "T09:00:00+03:00");

    MvcResult conflict = book(typeId, WEDNESDAY + "T09:00:00+03:00");

    assertThat(conflict.getResponse().getStatus()).isEqualTo(409);
    assertThat(conflictSlotStarts(conflict)).isEmpty();
  }

  @Test
  void rejectedBookingLeavesTheCalendarUnchanged() throws Exception {
    String typeId = createMeetingType(30);
    book(typeId, WEDNESDAY + "T09:00:00+03:00");
    List<String> before = slotStarts(typeId, WEDNESDAY);

    book(typeId, WEDNESDAY + "T09:15:00+03:00");

    assertThat(slotStarts(typeId, WEDNESDAY)).isEqualTo(before);
    assertThat(store.meetings()).hasSize(1);
  }

  private List<String> conflictSlotStarts(MvcResult result) throws Exception {
    List<Map<String, Object>> slots =
        JsonPath.read(result.getResponse().getContentAsString(), "$.slots");
    return slots.stream()
        .map(slot -> OffsetDateTime.parse((String) slot.get("startsAt")).format(TIME))
        .toList();
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

  private MvcResult book(String meetingTypeId, String startsAt) throws Exception {
    return mockMvc
        .perform(
            post("/api/meetings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"meetingTypeId": "%s", "startsAt": "%s"}
                    """
                        .formatted(meetingTypeId, startsAt)))
        .andReturn();
  }

  private String slotsJson(String typeId) throws Exception {
    return mockMvc
        .perform(get("/api/meeting-types/{id}/slots", typeId))
        .andExpect(status().isOk())
        .andReturn()
        .getResponse()
        .getContentAsString();
  }

  private List<String> slotStarts(String typeId, String date) throws Exception {
    List<Map<String, Object>> days = JsonPath.read(slotsJson(typeId), "$.days");
    Map<String, Object> day =
        days.stream()
            .filter(candidate -> date.equals(candidate.get("date")))
            .findFirst()
            .orElseThrow(() -> new AssertionError("В окне нет дня " + date));
    @SuppressWarnings("unchecked")
    List<Map<String, String>> slots = (List<Map<String, String>>) day.get("slots");
    return slots.stream()
        .map(slot -> OffsetDateTime.parse(slot.get("startsAt")).format(TIME))
        .toList();
  }
}
