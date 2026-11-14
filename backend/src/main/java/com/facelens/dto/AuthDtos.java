package com.facelens.dto;

import com.facelens.entity.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @Email @NotBlank String email,
            @NotBlank @Size(min = 8, max = 128) String password
    ) {
    }

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {
    }

    public record UserDto(Long id, String email, Instant createdAt) {
        public static UserDto from(User user) {
            return new UserDto(user.getId(), user.getEmail(), user.getCreatedAt());
        }
    }

    public record TokenResponse(String accessToken, String tokenType, UserDto user) {
        public static TokenResponse of(String accessToken, User user) {
            return new TokenResponse(accessToken, "bearer", UserDto.from(user));
        }
    }
}
