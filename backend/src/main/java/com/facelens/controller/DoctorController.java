package com.facelens.controller;

import com.facelens.auth.UserPrincipal;
import com.facelens.dto.DoctorDtos.DermatologistDto;
import com.facelens.dto.DoctorDtos.QuestionAnswerRequest;
import com.facelens.dto.DoctorDtos.QuestionCreateRequest;
import com.facelens.dto.DoctorDtos.QuestionDto;
import com.facelens.dto.DoctorDtos.VisitDto;
import com.facelens.dto.DoctorDtos.VisitRequest;
import com.facelens.dto.DoctorDtos.VisitUpdateRequest;
import com.facelens.entity.Dermatologist;
import com.facelens.entity.DoctorQuestion;
import com.facelens.entity.DoctorVisit;
import com.facelens.exception.ApiException;
import com.facelens.repository.DermatologistRepository;
import com.facelens.repository.DoctorQuestionRepository;
import com.facelens.repository.DoctorVisitRepository;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/doctors")
public class DoctorController {

    private final DermatologistRepository dermatologistRepository;
    private final DoctorQuestionRepository questionRepository;
    private final DoctorVisitRepository visitRepository;

    public DoctorController(
            DermatologistRepository dermatologistRepository,
            DoctorQuestionRepository questionRepository,
            DoctorVisitRepository visitRepository
    ) {
        this.dermatologistRepository = dermatologistRepository;
        this.questionRepository = questionRepository;
        this.visitRepository = visitRepository;
    }

    @GetMapping
    public List<DermatologistDto> doctors(
            @RequestParam(required = false) String city,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Dermatologist> doctors = city == null || city.isBlank()
                ? dermatologistRepository.findAllByOrderByCityAscNameAsc()
                : dermatologistRepository.findByCityContainingIgnoreCaseOrderByCityAscNameAsc(city.trim());
        return doctors.stream().map(DoctorController::toDto).toList();
    }

    @GetMapping("/cities")
    public List<String> cities(@AuthenticationPrincipal UserPrincipal principal) {
        return dermatologistRepository.findDistinctCities();
    }

    @GetMapping("/questions")
    public List<QuestionDto> questions(@AuthenticationPrincipal UserPrincipal principal) {
        return questionRepository.findByUserIdOrderByCreatedAtDesc(principal.getId())
                .stream()
                .map(DoctorController::toDto)
                .toList();
    }

    @PostMapping("/questions")
    @ResponseStatus(HttpStatus.CREATED)
    public QuestionDto createQuestion(
            @Valid @RequestBody QuestionCreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DoctorQuestion question = new DoctorQuestion();
        question.setUserId(principal.getId());
        question.setQuestion(request.question().trim());
        questionRepository.save(question);
        return toDto(question);
    }

    @PatchMapping("/questions/{id}")
    public QuestionDto answerQuestion(
            @PathVariable Long id,
            @Valid @RequestBody QuestionAnswerRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DoctorQuestion question = questionRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Question not found."));
        question.setAnswer(request.answer().trim());
        question.setStatus("answered");
        question.setAnsweredAt(Instant.now());
        questionRepository.save(question);
        return toDto(question);
    }

    @DeleteMapping("/questions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteQuestion(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DoctorQuestion question = questionRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Question not found."));
        questionRepository.delete(question);
    }

    @GetMapping("/visits")
    public List<VisitDto> visits(@AuthenticationPrincipal UserPrincipal principal) {
        return visitRepository.findByUserIdOrderByVisitDateDescIdDesc(principal.getId())
                .stream()
                .map(DoctorController::toDto)
                .toList();
    }

    @PostMapping("/visits")
    @ResponseStatus(HttpStatus.CREATED)
    public VisitDto createVisit(
            @Valid @RequestBody VisitRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DoctorVisit visit = new DoctorVisit();
        visit.setUserId(principal.getId());
        visit.setVisitDate(request.visitDate());
        visit.setDoctorName(request.doctorName().trim());
        visit.setClinic(request.clinic());
        visit.setNotes(request.notes());
        visit.setPrescription(request.prescription());
        visit.setNextFollowup(request.nextFollowup());
        visitRepository.save(visit);
        return toDto(visit);
    }

    @PatchMapping("/visits/{id}")
    public VisitDto updateVisit(
            @PathVariable Long id,
            @RequestBody VisitUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DoctorVisit visit = visitRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Visit not found."));

        if (request.visitDate() != null) {
            visit.setVisitDate(request.visitDate());
        }
        if (request.doctorName() != null) {
            if (request.doctorName().isBlank()) {
                throw new ApiException(400, "Doctor name cannot be empty.");
            }
            visit.setDoctorName(request.doctorName().trim());
        }
        if (request.clinic() != null) {
            visit.setClinic(request.clinic());
        }
        if (request.notes() != null) {
            visit.setNotes(request.notes());
        }
        if (request.prescription() != null) {
            visit.setPrescription(request.prescription());
        }
        if (request.nextFollowup() != null) {
            visit.setNextFollowup(request.nextFollowup());
        }

        visitRepository.save(visit);
        return toDto(visit);
    }

    @DeleteMapping("/visits/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteVisit(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        DoctorVisit visit = visitRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new ApiException(404, "Visit not found."));
        visitRepository.delete(visit);
    }

    private static DermatologistDto toDto(Dermatologist doctor) {
        return new DermatologistDto(
                doctor.getId(),
                doctor.getName(),
                doctor.getCity(),
                doctor.getSpecialty(),
                doctor.getPhone(),
                doctor.getAddress()
        );
    }

    private static QuestionDto toDto(DoctorQuestion question) {
        return new QuestionDto(
                question.getId(),
                question.getQuestion(),
                question.getStatus(),
                question.getAnswer(),
                question.getCreatedAt(),
                question.getAnsweredAt()
        );
    }

    private static VisitDto toDto(DoctorVisit visit) {
        return new VisitDto(
                visit.getId(),
                visit.getVisitDate(),
                visit.getDoctorName(),
                visit.getClinic(),
                visit.getNotes(),
                visit.getPrescription(),
                visit.getNextFollowup(),
                visit.getCreatedAt()
        );
    }
}
