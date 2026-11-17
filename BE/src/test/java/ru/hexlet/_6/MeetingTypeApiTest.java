package ru.hexlet._6;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
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

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestClockConfiguration.class)
class MeetingTypeApiTest {

  @Autowired private MockMvc mockMvc;
  @Autowired private InMemoryStore store;

  @BeforeEach
  void clearStore() {
    store.clear();
  }

  private MvcResult create(String body) throws Exception {
    return mockMvc
        .perform(post("/api/meeting-types").contentType(MediaType.APPLICATION_JSON).content(body))
        .andReturn();
  }

  @Test
  void createdMeetingTypeIsReturnedWithLocationAndAppearsInTheList() throws Exception {
    MvcResult result =
        create(
            """
            {"name": "  Консультация  ", "description": "  Разбор задачи  ", "durationMinutes": 30}
            """);

    assertThat(result.getResponse().getStatus()).isEqualTo(201);
    assertThat(result.getResponse().getContentAsString())
        .contains("\"name\":\"Консультация\"")
        .contains("\"description\":\"Разбор задачи\"")
        .contains("\"durationMinutes\":30");

    String id = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    assertThat(result.getResponse().getHeader("Location")).isEqualTo("/api/meeting-types/" + id);

    mockMvc
        .perform(get("/api/meeting-types"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(1))
        .andExpect(jsonPath("$.items[0].id").value(id))
        .andExpect(jsonPath("$.items[0].name").value("Консультация"))
        .andExpect(jsonPath("$.items[0].description").value("Разбор задачи"))
        .andExpect(jsonPath("$.items[0].durationMinutes").value(30));
  }

  @Test
  void listIsEmptyBeforeTheOwnerCreatesAnything() throws Exception {
    mockMvc
        .perform(get("/api/meeting-types"))
        .andExpect(status().isOk())
        .andExpect(header().doesNotExist("Location"))
        .andExpect(jsonPath("$.items.length()").value(0));
  }

  @Test
  void listKeepsCreationOrder() throws Exception {
    create("{\"name\": \"Первый\", \"description\": \"Описание\", \"durationMinutes\": 30}");
    create("{\"name\": \"Второй\", \"description\": \"Описание\", \"durationMinutes\": 60}");

    mockMvc
        .perform(get("/api/meeting-types"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items[0].name").value("Первый"))
        .andExpect(jsonPath("$.items[1].name").value("Второй"));
  }

  private void assertFieldError(String body, String field) throws Exception {
    mockMvc
        .perform(post("/api/meeting-types").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(jsonPath("$.fieldErrors[*].field", hasItem(field)));
  }

  private static String body(String name, String description, String duration) {
    return """
    {"name": %s, "description": %s, "durationMinutes": %s}
    """
        .formatted(name, description, duration);
  }

  @Test
  void blankNameIsRejected() throws Exception {
    assertFieldError(body("\"   \"", "\"Описание\"", "30"), "name");
  }

  @Test
  void nameLongerThanHundredCharactersIsRejected() throws Exception {
    assertFieldError(body("\"" + "я".repeat(101) + "\"", "\"Описание\"", "30"), "name");
  }

  @Test
  void blankDescriptionIsRejected() throws Exception {
    assertFieldError(body("\"Консультация\"", "\"\"", "30"), "description");
  }

  @Test
  void descriptionLongerThanFiveHundredCharactersIsRejected() throws Exception {
    assertFieldError(body("\"Консультация\"", "\"" + "я".repeat(501) + "\"", "30"), "description");
  }

  @Test
  void missingFieldsAreReportedAsFieldErrors() throws Exception {
    mockMvc
        .perform(post("/api/meeting-types").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
        .andExpect(
            jsonPath(
                "$.fieldErrors[*].field",
                containsInAnyOrder("name", "description", "durationMinutes")));
  }

  @ParameterizedTest
  @ValueSource(ints = {0, 4, 7, 481, 483})
  void durationOutsideTheStepRangeIsRejected(int durationMinutes) throws Exception {
    assertFieldError(
        body("\"Консультация\"", "\"Описание\"", String.valueOf(durationMinutes)),
        "durationMinutes");
  }

  @ParameterizedTest
  @ValueSource(ints = {5, 480})
  void boundaryDurationsAreAccepted(int durationMinutes) throws Exception {
    MvcResult result =
        create(body("\"Консультация\"", "\"Описание\"", String.valueOf(durationMinutes)));

    assertThat(result.getResponse().getStatus()).isEqualTo(201);
    assertThat(result.getResponse().getContentAsString())
        .contains("\"durationMinutes\":" + durationMinutes);
  }

  @Test
  void unreadableBodyIsRejectedWithValidationFailed() throws Exception {
    mockMvc
        .perform(
            post("/api/meeting-types")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": "))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
  }

  @Test
  void rejectedRequestDoesNotCreateMeetingType() throws Exception {
    assertFieldError(body("\"\"", "\"Описание\"", "30"), "name");

    mockMvc
        .perform(get("/api/meeting-types"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.items.length()").value(0));
  }
}
