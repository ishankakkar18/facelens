package com.facelens.dto;

import java.time.Instant;
import java.time.LocalDate;

public final class ProgressDtos {

    private ProgressDtos() {
    }

    public record ProgressPhotoDto(
            Long id,
            LocalDate photoDate,
            String imageUrl,
            Long analysisId,
            String notes,
            Instant createdAt
    ) {
    }
}
