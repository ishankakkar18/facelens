package com.facelens.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class AnalysisDtos {

    private AnalysisDtos() {
    }

    public record AnalyzeResponse(
            Long id,
            String imageUrl,
            String frontImageUrl,
            String rightImageUrl,
            String leftImageUrl,
            Map<String, Object> result
    ) {
    }

    public record AnalysisDto(
            Long id,
            String imageUrl,
            String frontImageUrl,
            String rightImageUrl,
            String leftImageUrl,
            Map<String, Object> resultJson,
            Instant createdAt
    ) {
    }

    public record AnalysisListDto(List<AnalysisDto> items, long total) {
    }
}
