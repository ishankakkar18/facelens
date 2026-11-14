package com.facelens.service;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.facelens.exception.ApiException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

@Service
public class GeminiService {

    private static final String SYSTEM_PROMPT = """
            You are FaceLens, a kind, evidence-informed skin and grooming coach.
            You analyze a single selfie and return a supportive, practical report.

            Hard rules:
            - Never diagnose a medical condition. You may mention visible signs and suggest seeing a dermatologist when appropriate.
            - Never rate attractiveness or call anyone ugly/pretty. Use neutral, inclusive language.
            - Do not guess ethnicity, sex, or identity. Do not comment on weight.
            - Keep advice realistic, affordable, and non-invasive. No surgery or extreme procedures.
            - Suggestions must be concrete and safe: skincare, grooming, sleep, hydration, sun protection, posture, stress.
            - If the photo does not contain a clear, front-facing human face, return an "error" object instead of guessing.

            Return ONLY valid JSON matching the requested shape.
            """;

    private static final String USER_PROMPT = """
            Analyze the face in this photo.

            Return JSON with exactly these keys:
            {
              "valid_face": true,
              "overall_description": "2-4 warm, descriptive sentences about the face and its overall character",
              "estimated_age_range": "e.g. 25-32 (an estimate, not a fact)",
              "facial_shape": "e.g. oval, round, square, heart, diamond, oblong",
              "symmetry_notes": "neutral observations about facial balance",
              "skin": {
                "tone": "neutral description",
                "texture": "neutral description",
                "concerns": ["short visible concerns, e.g. mild redness, dryness, uneven tone"]
              },
              "features": {
                "eyes": "short neutral note",
                "nose": "short neutral note",
                "lips": "short neutral note",
                "jawline": "short neutral note"
              },
              "strengths": ["3-5 genuine strengths"],
              "areas_to_improve": ["2-4 gentle, actionable focus areas"],
              "suggestions": {
                "skincare": ["3-5 specific steps/products types"],
                "grooming": ["2-4 specific grooming ideas"],
                "lifestyle": ["2-4 habits: sleep, hydration, sun, posture, stress"],
                "professional": ["when/why to see a dermatologist, if relevant; empty array if not"]
              },
              "disclaimer": "This is a general wellness analysis, not medical advice."
            }

            If no clear face is present, return:
            {"valid_face": false, "error": "reason"}
            """;

    private static final String CHANGE_PROMPT = """
            Compare two FaceLens skin/grooming reports for the same person:
            - PREVIOUS (older)
            - CURRENT (newer)

            Return JSON with exactly these keys:
            {
              "summary": "3-5 supportive sentences describing what changed and what it likely means",
              "improved": ["things that look better now"],
              "worsened": ["things that look worse or need attention"],
              "unchanged": ["things that stayed about the same"],
              "next_focus": ["2-4 concrete priorities for the next period"]
            }

            Be gentle and factual. Never diagnose. If the reports contain no meaningful difference,
            say so plainly and keep the lists short. Return ONLY JSON.
            """;

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String apiKey;
    private final String model;

    public GeminiService(
            ObjectMapper objectMapper,
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-3.5-flash}") String model
    ) {
        this.restClient = RestClient.builder()
                .baseUrl("https://generativelanguage.googleapis.com")
                .build();
        this.objectMapper = objectMapper;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model;
    }

    public Map<String, Object> analyze(byte[] imageBytes, String mimeType) {
        if (apiKey.isBlank()) {
            throw new ApiException(502,
                    "GEMINI_API_KEY is not configured. Copy backend/.env.example to backend/.env and add your key.");
        }

        String encoded = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("system_instruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        payload.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(
                        Map.of("text", USER_PROMPT),
                        Map.of("inline_data", Map.of("mime_type", mimeType, "data", encoded))
                )
        )));
        payload.put("generationConfig", Map.of(
                "temperature", 0.4,
                "responseMimeType", "application/json",
                "maxOutputTokens", 2048
        ));

        String text = callGemini(payload);
        return parseJsonObject(text);
    }

    public Map<String, Object> summarizeChanges(Map<String, Object> previous, Map<String, Object> current) {
        if (apiKey.isBlank()) {
            throw new ApiException(502,
                    "GEMINI_API_KEY is not configured. Copy backend/.env.example to backend/.env and add your key.");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("system_instruction", Map.of("parts", List.of(Map.of("text", SYSTEM_PROMPT))));
        payload.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(
                        Map.of("text", CHANGE_PROMPT),
                        Map.of("text", "PREVIOUS:\n" + writeJson(previous)),
                        Map.of("text", "CURRENT:\n" + writeJson(current))
                )
        )));
        payload.put("generationConfig", Map.of(
                "temperature", 0.3,
                "responseMimeType", "application/json",
                "maxOutputTokens", 1024
        ));

        String text = callGemini(payload);
        return parseJsonObject(text);
    }

    private String callGemini(Map<String, Object> payload) {
        String path = "/v1beta/models/" + model + ":generateContent";
        try {
            String body = restClient.post()
                    .uri(uriBuilder -> uriBuilder.path(path).queryParam("key", apiKey).build())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .body(String.class);

            JsonNode root = objectMapper.readTree(body == null ? "{}" : body);
            JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
            if (textNode.isMissingNode() || textNode.asText().isBlank()) {
                throw new ApiException(502, "Gemini returned an unexpected response shape.");
            }
            return textNode.asText();
        } catch (RestClientResponseException exception) {
            String detail = exception.getResponseBodyAsString();
            if (detail.length() > 500) {
                detail = detail.substring(0, 500);
            }
            throw new ApiException(502,
                    "Gemini API error (" + exception.getStatusCode().value() + "): " + detail);
        } catch (RestClientException exception) {
            throw new ApiException(502, "Could not reach Gemini: " + exception.getMessage());
        } catch (Exception exception) {
            throw new ApiException(502, "Gemini request failed: " + exception.getMessage());
        }
    }

    private Map<String, Object> parseJsonObject(String text) {
        String cleaned = stripCodeFences(text);
        try {
            return objectMapper.readValue(cleaned, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception exception) {
            throw new ApiException(502, "Gemini returned invalid JSON.");
        }
    }

    private String writeJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            return "{}";
        }
    }

    private static String stripCodeFences(String text) {
        String value = text == null ? "" : text.trim();
        if (value.startsWith("```")) {
            int firstNewline = value.indexOf('\n');
            if (firstNewline >= 0) {
                value = value.substring(firstNewline + 1);
            }
            if (value.endsWith("```")) {
                value = value.substring(0, value.length() - 3);
            }
        }
        int start = value.indexOf('{');
        int end = value.lastIndexOf('}');
        if (start >= 0 && end > start) {
            value = value.substring(start, end + 1);
        }
        return value.trim();
    }
}
