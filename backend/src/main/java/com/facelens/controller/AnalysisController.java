package com.facelens.controller;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.facelens.auth.UserPrincipal;
import com.facelens.dto.AnalysisDtos.AnalysisDto;
import com.facelens.dto.AnalysisDtos.AnalysisListDto;
import com.facelens.entity.Analysis;
import com.facelens.exception.ApiException;
import com.facelens.repository.AnalysisRepository;
import com.facelens.service.HabitService;
import com.facelens.service.PdfService;
import com.facelens.service.StorageService;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/analyses")
public class AnalysisController {

    private final AnalysisRepository analysisRepository;
    private final StorageService storageService;
    private final PdfService pdfService;
    private final HabitService habitService;
    private final ObjectMapper objectMapper;

    public AnalysisController(
            AnalysisRepository analysisRepository,
            StorageService storageService,
            PdfService pdfService,
            HabitService habitService,
            ObjectMapper objectMapper
    ) {
        this.analysisRepository = analysisRepository;
        this.storageService = storageService;
        this.pdfService = pdfService;
        this.habitService = habitService;
        this.objectMapper = objectMapper;
    }

    @GetMapping
    public AnalysisListDto list(
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        int safeLimit = Math.min(Math.max(limit, 1), 100);
        int safeOffset = Math.max(offset, 0);
        List<AnalysisDto> items = analysisRepository
                .findPage(principal.getId(), safeLimit, safeOffset)
                .stream()
                .map(this::toDto)
                .toList();
        long total = analysisRepository.countByUserId(principal.getId());
        return new AnalysisListDto(items, total);
    }

    @GetMapping("/{id}")
    public AnalysisDto get(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return toDto(owned(id, principal));
    }

    @PostMapping("/{id}/sync-routine")
    public java.util.Map<String, Object> syncRoutine(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Analysis analysis = owned(id, principal);
        HabitService.RoutineSyncResult sync = habitService.syncRoutineFromAnalysis(
                principal.getId(), analysis.getId(), parseResult(analysis));
        return java.util.Map.of(
                "added", sync.added(),
                "updated", sync.updated(),
                "paused", sync.paused()
        );
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Analysis analysis = owned(id, principal);
        analysisRepository.delete(analysis);
        storageService.delete(analysis.getImageUrl());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> pdf(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Analysis analysis = owned(id, principal);
        Map<String, Object> result = parseResult(analysis);
        String dateLabel = DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH)
                .withZone(ZoneId.systemDefault())
                .format(analysis.getCreatedAt());
        byte[] pdf = pdfService.build(result, dateLabel);

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"facelens-report-" + id + ".pdf\"")
                .body(pdf);
    }

    private Analysis owned(Long id, UserPrincipal principal) {
        return analysisRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Analysis not found."));
    }

    private AnalysisDto toDto(Analysis analysis) {
        return new AnalysisDto(
                analysis.getId(),
                analysis.getImageUrl(),
                analysis.getFrontImageUrl(),
                analysis.getRightImageUrl(),
                analysis.getLeftImageUrl(),
                parseResult(analysis),
                analysis.getCreatedAt()
        );
    }

    private Map<String, Object> parseResult(Analysis analysis) {
        try {
            return objectMapper.readValue(analysis.getResultJson(), new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception exception) {
            throw new ApiException(500, "Stored analysis is not valid JSON.");
        }
    }
}
