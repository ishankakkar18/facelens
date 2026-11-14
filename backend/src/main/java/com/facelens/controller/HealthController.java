package com.facelens.controller;

import java.time.Instant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
                "status", "ok",
                "app", "FaceLens API",
                "time", Instant.now().getEpochSecond()
        );
    }

    @GetMapping("/")
    public Map<String, String> root() {
        return Map.of(
                "message", "FaceLens API",
                "docs", "/v3/api-docs",
                "health", "/health"
        );
    }
}
