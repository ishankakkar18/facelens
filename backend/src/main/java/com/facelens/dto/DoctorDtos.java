package com.facelens.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.time.LocalDate;

public final class DoctorDtos {

    private DoctorDtos() {
    }

    public record QuestionCreateRequest(
            @NotBlank @Size(min = 5, max = 2000) String question
    ) {
    }

    public record QuestionAnswerRequest(
            @NotBlank @Size(max = 5000) String answer
    ) {
    }

    public record QuestionDto(
            Long id,
            String question,
            String status,
            String answer,
            Instant createdAt,
            Instant answeredAt
    ) {
    }

    public record VisitRequest(
            @NotNull LocalDate visitDate,
            @NotBlank @Size(max = 255) String doctorName,
            String clinic,
            String notes,
            String prescription,
            LocalDate nextFollowup
    ) {
    }

    public record VisitUpdateRequest(
            LocalDate visitDate,
            String doctorName,
            String clinic,
            String notes,
            String prescription,
            LocalDate nextFollowup
    ) {
    }

    public record VisitDto(
            Long id,
            LocalDate visitDate,
            String doctorName,
            String clinic,
            String notes,
            String prescription,
            LocalDate nextFollowup,
            Instant createdAt
    ) {
    }

    public record DermatologistDto(
            Long id,
            String name,
            String city,
            String specialty,
            String phone,
            String address
    ) {
    }
}
