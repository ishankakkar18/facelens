package com.facelens.controller;

import tools.jackson.databind.ObjectMapper;
import com.facelens.auth.UserPrincipal;
import com.facelens.dto.AnalysisDtos.AnalyzeResponse;
import com.facelens.entity.Analysis;
import com.facelens.entity.Consent;
import com.facelens.exception.ApiException;
import com.facelens.exception.PhotoValidationException;
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
import java.util.LinkedHashMap;
import java.util.List;
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
    private static final List<String> ANGLES = List.of("front", "right", "left");

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
            @RequestParam("front") MultipartFile front,
            @RequestParam("right") MultipartFile right,
            @RequestParam("left") MultipartFile left,
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

        ImageData frontImage = readImage(front, "Front");
        ImageData rightImage = readImage(right, "Right-side");
        ImageData leftImage = readImage(left, "Left-side");

        Consent record = new Consent();
        record.setUserId(principal == null ? null : principal.getId());
        record.setIpHash(hashIp(ip));
        consentRepository.save(record);

        Map<String, Object> result = geminiService.analyzeFace(
                frontImage.bytes(), frontImage.contentType(),
                rightImage.bytes(), rightImage.contentType(),
                leftImage.bytes(), leftImage.contentType()
        );

        validatePhotoAngles(result);

        Long analysisId = null;
        String frontUrl = null;
        String rightUrl = null;
        String leftUrl = null;

        if (save && principal != null) {
            frontUrl = storageService.upload(frontImage.bytes(), frontImage.contentType());
            rightUrl = storageService.upload(rightImage.bytes(), rightImage.contentType());
            leftUrl = storageService.upload(leftImage.bytes(), leftImage.contentType());

            Analysis analysis = new Analysis();
            analysis.setUserId(principal.getId());
            analysis.setImageUrl(frontUrl);
            analysis.setFrontImageUrl(frontUrl);
            analysis.setRightImageUrl(rightUrl);
            analysis.setLeftImageUrl(leftUrl);
            analysis.setResultJson(objectMapper.writeValueAsString(result));
            analysisRepository.save(analysis);
            analysisId = analysis.getId();
            habitService.createFromAnalysis(principal.getId(), analysis.getId(), result);
        }

        return new AnalyzeResponse(analysisId, frontUrl, frontUrl, rightUrl, leftUrl, result);
    }

    @SuppressWarnings("unchecked")
    private static void validatePhotoAngles(Map<String, Object> result) {
        Object validValue = result.get("valid_photos");
        if (!(validValue instanceof Map<?, ?> validMap)) {
            if (Boolean.FALSE.equals(result.get("valid_face"))) {
                throw new ApiException(422,
                        "No clear, front-facing face was detected. Try another set of photos.");
            }
            return;
        }

        Map<String, Object> photoNotes = result.get("photo_notes") instanceof Map<?, ?> notes
                ? (Map<String, Object>) notes
                : Map.of();

        Map<String, String> errors = new LinkedHashMap<>();
        for (String angle : ANGLES) {
            if (Boolean.FALSE.equals(validMap.get(angle))) {
                Object note = photoNotes.get(angle);
                errors.put(angle, note == null
                        ? "This photo does not match the requested angle. Please retake it."
                        : note.toString());
            }
        }

        if (!errors.isEmpty()) {
            Object message = result.get("validation_error");
            throw new PhotoValidationException(
                    message == null ? "One or more photos are not correct. Please retake them." : message.toString(),
                    errors
            );
        }
    }

    private static ImageData readImage(MultipartFile file, String label) throws Exception {
        if (file == null || file.isEmpty()) {
            throw new ApiException(400, label + " photo is missing.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new ApiException(400, label + " photo must be a JPG, PNG, or WEBP image.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(400, label + " photo is too large. Maximum size is 8 MB.");
        }
        return new ImageData(file.getBytes(), contentType);
    }

    private record ImageData(byte[] bytes, String contentType) {
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
