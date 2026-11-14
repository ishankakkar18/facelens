package com.facelens.controller;

import tools.jackson.databind.ObjectMapper;
import com.facelens.auth.UserPrincipal;
import com.facelens.dto.AnalysisDtos.AnalyzeResponse;
import com.facelens.entity.Analysis;
import com.facelens.entity.Consent;
import com.facelens.exception.ApiException;
import com.facelens.repository.AnalysisRepository;
import com.facelens.repository.ConsentRepository;
import com.facelens.service.GeminiService;
import com.facelens.service.HabitService;
import com.facelens.service.RateLimiter;
import com.facelens.service.StorageService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import java.util.Set;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class AnalyzeController {

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long MAX_BYTES = 8L * 1024 * 1024;

    private final GeminiService geminiService;
    private final StorageService storageService;
    private final HabitService habitService;
    private final AnalysisRepository analysisRepository;
    private final ConsentRepository consentRepository;
    private final RateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    public AnalyzeController(
            GeminiService geminiService,
            StorageService storageService,
            HabitService habitService,
            AnalysisRepository analysisRepository,
            ConsentRepository consentRepository,
            RateLimiter rateLimiter,
            ObjectMapper objectMapper
    ) {
        this.geminiService = geminiService;
        this.storageService = storageService;
        this.habitService = habitService;
        this.analysisRepository = analysisRepository;
        this.consentRepository = consentRepository;
        this.rateLimiter = rateLimiter;
        this.objectMapper = objectMapper;
    }

    @PostMapping(value = "/api/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AnalyzeResponse analyze(
            @RequestParam("file") MultipartFile file,
            @RequestParam("consent") boolean consent,
            @RequestParam(value = "save", defaultValue = "false") boolean save,
            HttpServletRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) throws Exception {
        String ip = clientIp(request);
        rateLimiter.check(ip);

        if (!consent) {
            throw new ApiException(400, "You must consent to photo analysis first.");
        }
        if (save && principal == null) {
            throw new ApiException(401, "Log in to save analyses to your history.");
        }
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

        Consent record = new Consent();
        record.setUserId(principal == null ? null : principal.getId());
        record.setIpHash(hashIp(ip));
        consentRepository.save(record);

        byte[] bytes = file.getBytes();
        Map<String, Object> result = geminiService.analyze(bytes, contentType);

        Object validFace = result.get("valid_face");
        if (Boolean.FALSE.equals(validFace)) {
            Object error = result.get("error");
            throw new ApiException(422,
                    error == null ? "No clear, front-facing face was detected. Try another selfie." : error.toString());
        }

        Long analysisId = null;
        String imageUrl = null;

        if (save && principal != null) {
            imageUrl = storageService.upload(bytes, contentType);
            Analysis analysis = new Analysis();
            analysis.setUserId(principal.getId());
            analysis.setImageUrl(imageUrl);
            analysis.setResultJson(objectMapper.writeValueAsString(result));
            analysisRepository.save(analysis);
            analysisId = analysis.getId();
            habitService.createFromAnalysis(principal.getId(), analysis.getId(), result);
        }

        return new AnalyzeResponse(analysisId, imageUrl, result);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private static String hashIp(String ip) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(ip.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < 16; index++) {
                builder.append(String.format("%02x", digest[index]));
            }
            return builder.toString();
        } catch (NoSuchAlgorithmException exception) {
            return null;
        }
    }
}
