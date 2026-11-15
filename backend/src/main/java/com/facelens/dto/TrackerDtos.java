package com.facelens.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public final class TrackerDtos {

    private TrackerDtos() {
    }

    public record HabitCreateRequest(
            @NotBlank String title,
            @Pattern(regexp = "^(skincare|grooming|lifestyle|professional)$") String category
    ) {
        public HabitCreateRequest {
            if (category == null || category.isBlank()) {
                category = "skincare";
            }
        }
    }

    public record HabitUpdateRequest(String title, String category, Boolean active) {
    }

    public record HabitDto(
            Long id,
            String title,
            String category,
            String source,
            Long sourceAnalysisId,
            boolean active,
            Instant createdAt
    ) {
    }

    public record HabitLogRequest(
            @NotNull Long habitId,
            @NotNull LocalDate logDate,
            boolean completed,
            String notes
    ) {
    }

    public record HabitLogDto(Long id, Long habitId, LocalDate logDate, boolean completed, String notes) {
    }

    public record TodayHabitDto(HabitDto habit, boolean completed, String notes) {
    }

    public record TrackerSummaryDto(
            LocalDate today,
            List<TodayHabitDto> habits,
            int completedCount,
            int totalCount,
            double completionRate,
            int streak
    ) {
    }

    public record HeatmapDayDto(LocalDate date, int completed, int total, double ratio) {
    }
}
