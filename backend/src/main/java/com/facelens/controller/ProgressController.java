package com.facelens.controller;

import tools.jackson.databind.ObjectMapper;
import com.facelens.auth.UserPrincipal;
import com.facelens.dto.ProgressDtos.ProgressPhotoDto;
import com.facelens.entity.Analysis;
import com.facelens.entity.ProgressPhoto;
import com.facelens.exception.ApiException;
import com.facelens.repository.AnalysisRepository;
import com.facelens.repository.ProgressPhotoRepository;
import com.facelens.service.GeminiService;
import com.facelens.service.StorageService;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/progress")
public class ProgressController {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_BYTES = 8L * 1024 * 1024;

    private final ProgressPhotoRepository progressPhotoRepository;
    private final AnalysisRepository analysisRepository;
    private final StorageService storageService;
    private final GeminiService geminiService;
    private final ObjectMapper objectMapper;

    public ProgressController(
            ProgressPhotoRepository progressPhotoRepository,
            AnalysisRepository analysisRepository,
            StorageService storageService,
            GeminiService geminiService,
            ObjectMapper objectMapper
    ) {
        this.progressPhotoRepository = progressPhotoRepository;
        this.analysisRepository = analysisRepository;
        this.storageService = storageService;
        this.geminiService = geminiService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/photos")
    public List<ProgressPhotoDto> photos(@AuthenticationPrincipal UserPrincipal principal) {
        return progressPhotoRepository
                .findByUserIdOrderByPhotoDateDescIdDesc(principal.getId())
                .stream()
                .map(ProgressController::toDto)
                .toList();
    }

    @PostMapping(value = "/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ProgressPhotoDto> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "photo_date", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate photoDate,
            @RequestParam(name = "notes", required = false) String notes,
            @RequestParam(name = "run_analysis", defaultValue = "false") boolean runAnalysis,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, "The uploaded file is empty.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new ApiException(400, "Please upload a JPG, PNG, or WEBP image.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(400, "Image is too large. Maximum size is 8 MB.");
        }

        byte[] bytes = file.getBytes();
        String imageUrl = storageService.upload(bytes, contentType);
        Long analysisId = null;

        if (runAnalysis) {
            Map<String, Object> result = geminiService.analyze(bytes, contentType);
            Object validFace = result.get("valid_face");
            if (!Boolean.FALSE.equals(validFace)) {
                Analysis analysis = new Analysis();
                analysis.setUserId(principal.getId());
                analysis.setImageUrl(imageUrl);
                analysis.setResultJson(objectMapper.writeValueAsString(result));
                analysisRepository.save(analysis);
                analysisId = analysis.getId();
            }
        }

        ProgressPhoto photo = new ProgressPhoto();
        photo.setUserId(principal.getId());
        photo.setPhotoDate(photoDate == null ? LocalDate.now() : photoDate);
        photo.setImageUrl(imageUrl);
        photo.setAnalysisId(analysisId);
        photo.setNotes(notes);
        progressPhotoRepository.save(photo);

        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(photo));
    }

    @DeleteMapping("/photos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ProgressPhoto photo = progressPhotoRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Photo not found."));
        progressPhotoRepository.delete(photo);
        storageService.delete(photo.getImageUrl());
    }

    private static ProgressPhotoDto toDto(ProgressPhoto photo) {
        return new ProgressPhotoDto(
                photo.getId(),
                photo.getPhotoDate(),
                photo.getImageUrl(),
                photo.getAnalysisId(),
                photo.getNotes(),
                photo.getCreatedAt()
        );
    }
}
