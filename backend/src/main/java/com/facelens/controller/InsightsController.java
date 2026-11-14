package com.facelens.controller;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.facelens.auth.UserPrincipal;
import com.facelens.entity.Analysis;
import com.facelens.exception.ApiException;
import com.facelens.repository.AnalysisRepository;
import com.facelens.service.GeminiService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/insights")
public class InsightsController {

    private final AnalysisRepository analysisRepository;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;

    public InsightsController(
            AnalysisRepository analysisRepository,
            GeminiService geminiService,
            ObjectMapper objectMapper
    ) {
        this.analysisRepository = analysisRepository;
        this.geminiService = geminiService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/changes")
    public Map<String, Object> changes(
            @RequestParam(name = "previous_id", required = false) Long previousId,
            @RequestParam(name = "current_id", required = false) Long currentId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Analysis previous;
        Analysis current;

        if (previousId != null || currentId != null) {
            if (previousId == null || currentId == null) {
                throw new ApiException(400, "Provide both previous_id and current_id.");
            }
            previous = owned(previousId, principal);
            current = owned(currentId, principal);
            if (previous.getId().equals(current.getId())) {
                throw new ApiException(400, "Pick two different analyses.");
            }
            if (previous.getCreatedAt().isAfter(current.getCreatedAt())) {
                Analysis swap = previous;
                previous = current;
                current = swap;
            }
        } else {
            List<Analysis> latest = analysisRepository
                    .findTop2ByUserIdOrderByCreatedAtDescIdDesc(principal.getId());
            if (latest.size() < 2) {
                throw new ApiException(400, "You need at least two saved analyses to see what changed.");
            }
            current = latest.get(0);
            previous = latest.get(1);
        }

        Map<String, Object> previousResult = parse(previous);
        Map<String, Object> currentResult = parse(current);
        Map<String, Object> diff = diff(previousResult, currentResult);

        Map<String, Object> ai = null;
        String aiError = null;
        try {
            ai = geminiService.summarizeChanges(previousResult, currentResult);
        } catch (ApiException exception) {
            aiError = exception.getMessage();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("previous", analysisNode(previous, previousResult));
        response.put("current", analysisNode(current, currentResult));
        response.put("diff", diff);
        response.put("ai", ai);
        response.put("ai_error", aiError);
        return response;
    }

    private Analysis owned(Long id, UserPrincipal principal) {
        return analysisRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Analysis not found."));
    }

    private Map<String, Object> parse(Analysis analysis) {
        try {
            return objectMapper.readValue(analysis.getResultJson(), new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception exception) {
            throw new ApiException(500, "Stored analysis is not valid JSON.");
        }
    }

    private static Map<String, Object> analysisNode(Analysis analysis, Map<String, Object> result) {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("id", analysis.getId());
        node.put("created_at", analysis.getCreatedAt());
        node.put("image_url", analysis.getImageUrl());
        node.put("result", result);
        return node;
    }

    private static Map<String, Object> diff(Map<String, Object> previous, Map<String, Object> current) {
        Map<String, Object> previousSkin = asMap(previous.get("skin"));
        Map<String, Object> currentSkin = asMap(current.get("skin"));

        Set<String> previousConcerns = asSet(previousSkin.get("concerns"));
        Set<String> currentConcerns = asSet(currentSkin.get("concerns"));
        Set<String> previousStrengths = asSet(previous.get("strengths"));
        Set<String> currentStrengths = asSet(current.get("strengths"));
        Set<String> previousFocus = asSet(previous.get("areas_to_improve"));
        Set<String> currentFocus = asSet(current.get("areas_to_improve"));

        Map<String, Object> diff = new LinkedHashMap<>();
        diff.put("concerns_added", difference(currentConcerns, previousConcerns));
        diff.put("concerns_removed", difference(previousConcerns, currentConcerns));
        diff.put("strengths_added", difference(currentStrengths, previousStrengths));
        diff.put("strengths_removed", difference(previousStrengths, currentStrengths));
        diff.put("focus_added", difference(currentFocus, previousFocus));
        diff.put("focus_removed", difference(previousFocus, currentFocus));

        Map<String, String> tone = new LinkedHashMap<>();
        tone.put("previous", asText(previousSkin.get("tone")));
        tone.put("current", asText(currentSkin.get("tone")));
        diff.put("skin_tone", tone);

        Map<String, String> texture = new LinkedHashMap<>();
        texture.put("previous", asText(previousSkin.get("texture")));
        texture.put("current", asText(currentSkin.get("texture")));
        diff.put("skin_texture", texture);

        return diff;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            return (Map<String, Object>) value;
        }
        return Map.of();
    }

    private static Set<String> asSet(Object value) {
        Set<String> values = new LinkedHashSet<>();
        if (value == null) {
            return values;
        }
        if (value instanceof Collection<?> collection) {
            for (Object item : collection) {
                if (item != null) {
                    String text = item.toString().trim().toLowerCase();
                    if (!text.isEmpty()) {
                        values.add(text);
                    }
                }
            }
        } else {
            String text = value.toString().trim().toLowerCase();
            if (!text.isEmpty()) {
                values.add(text);
            }
        }
        return values;
    }

    private static List<String> difference(Set<String> left, Set<String> right) {
        List<String> values = new ArrayList<>(left);
        values.removeAll(right);
        Collections.sort(values);
        return values;
    }

    private static String asText(Object value) {
        return value == null ? null : value.toString();
    }
}
