package com.facelens.controller;

import com.facelens.auth.UserPrincipal;
import com.facelens.dto.TrackerDtos.HabitCreateRequest;
import com.facelens.dto.TrackerDtos.HabitDto;
import com.facelens.dto.TrackerDtos.HabitLogDto;
import com.facelens.dto.TrackerDtos.HabitLogRequest;
import com.facelens.dto.TrackerDtos.HabitUpdateRequest;
import com.facelens.dto.TrackerDtos.HeatmapDayDto;
import com.facelens.dto.TrackerDtos.TodayHabitDto;
import com.facelens.dto.TrackerDtos.TrackerSummaryDto;
import com.facelens.entity.Habit;
import com.facelens.entity.HabitLog;
import com.facelens.exception.ApiException;
import com.facelens.repository.HabitLogRepository;
import com.facelens.repository.HabitRepository;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/tracker")
public class TrackerController {

    private static final Set<String> CATEGORIES =
            Set.of("skincare", "grooming", "lifestyle", "professional");

    private final HabitRepository habitRepository;
    private final HabitLogRepository habitLogRepository;

    public TrackerController(HabitRepository habitRepository, HabitLogRepository habitLogRepository) {
        this.habitRepository = habitRepository;
        this.habitLogRepository = habitLogRepository;
    }

    @GetMapping("/habits")
    public List<HabitDto> habits(
            @RequestParam(name = "include_inactive", defaultValue = "false") boolean includeInactive,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<Habit> habits = includeInactive
                ? habitRepository.findByUserIdOrderByCreatedAtAscIdAsc(principal.getId())
                : habitRepository.findByUserIdAndActiveTrueOrderByCreatedAtAscIdAsc(principal.getId());
        return habits.stream().map(TrackerController::toHabitDto).toList();
    }

    @PostMapping("/habits")
    @ResponseStatus(HttpStatus.CREATED)
    public HabitDto createHabit(
            @Valid @RequestBody HabitCreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Habit habit = new Habit();
        habit.setUserId(principal.getId());
        habit.setTitle(request.title().trim());
        habit.setCategory(request.category());
        habit.setSource("custom");
        habitRepository.save(habit);
        return toHabitDto(habit);
    }

    @PatchMapping("/habits/{id}")
    public HabitDto updateHabit(
            @PathVariable Long id,
            @RequestBody HabitUpdateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Habit habit = ownedHabit(id, principal);
        if (request.title() != null) {
            if (request.title().isBlank()) {
                throw new ApiException(400, "Habit title cannot be empty.");
            }
            habit.setTitle(request.title().trim());
        }
        if (request.category() != null) {
            if (!CATEGORIES.contains(request.category())) {
                throw new ApiException(400, "Invalid habit category.");
            }
            habit.setCategory(request.category());
        }
        if (request.active() != null) {
            habit.setActive(request.active());
        }
        habitRepository.save(habit);
        return toHabitDto(habit);
    }

    @DeleteMapping("/habits/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHabit(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        Habit habit = ownedHabit(id, principal);
        habitRepository.delete(habit);
    }

    @GetMapping("/logs")
    public List<HabitLogDto> logs(
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate today = LocalDate.now();
        LocalDate start = from == null ? today.minusDays(6) : from;
        LocalDate end = to == null ? today : to;
        return habitLogRepository
                .findByUserIdAndLogDateBetween(principal.getId(), start, end)
                .stream()
                .map(TrackerController::toLogDto)
                .toList();
    }

    @PostMapping("/logs")
    public HabitLogDto upsertLog(
            @Valid @RequestBody HabitLogRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ownedHabit(request.habitId(), principal);

        HabitLog log = habitLogRepository
                .findByUserIdAndHabitIdAndLogDate(principal.getId(), request.habitId(), request.logDate())
                .orElse(null);

        if (log == null) {
            log = new HabitLog();
            log.setUserId(principal.getId());
            log.setHabitId(request.habitId());
            log.setLogDate(request.logDate());
            log.setCompleted(request.completed());
            log.setNotes(request.notes());
        } else {
            log.setCompleted(request.completed());
            if (request.notes() != null) {
                log.setNotes(request.notes());
            }
        }

        habitLogRepository.save(log);
        return toLogDto(log);
    }

    @GetMapping("/summary")
    public TrackerSummaryDto summary(@AuthenticationPrincipal UserPrincipal principal) {
        LocalDate today = LocalDate.now();
        List<Habit> habits = habitRepository
                .findByUserIdAndActiveTrueOrderByCreatedAtAscIdAsc(principal.getId());

        LocalDate windowStart = today.minusDays(89);
        List<HabitLog> logs = habitLogRepository
                .findByUserIdAndLogDateBetween(principal.getId(), windowStart, today);

        Map<Long, HabitLog> todayLogs = new HashMap<>();
        Map<LocalDate, Set<Long>> completedByDay = new HashMap<>();
        for (HabitLog log : logs) {
            if (today.equals(log.getLogDate())) {
                todayLogs.put(log.getHabitId(), log);
            }
            if (log.isCompleted()) {
                completedByDay
                        .computeIfAbsent(log.getLogDate(), key -> new HashSet<>())
                        .add(log.getHabitId());
            }
        }

        Set<Long> activeIds = new HashSet<>();
        for (Habit habit : habits) {
            activeIds.add(habit.getId());
        }

        int completedCount = 0;
        for (Habit habit : habits) {
            HabitLog log = todayLogs.get(habit.getId());
            if (log != null && log.isCompleted()) {
                completedCount++;
            }
        }
        int totalCount = habits.size();
        double completionRate = totalCount == 0
                ? 0.0
                : Math.round((completedCount * 1000.0) / totalCount) / 1000.0;

        int streak = 0;
        if (!activeIds.isEmpty()) {
            LocalDate cursor = today;
            Set<Long> todayCompleted = completedByDay.getOrDefault(today, Set.of());
            if (!todayCompleted.containsAll(activeIds)) {
                cursor = today.minusDays(1);
            }
            while (!cursor.isBefore(windowStart)
                    && completedByDay.getOrDefault(cursor, Set.of()).containsAll(activeIds)) {
                streak++;
                cursor = cursor.minusDays(1);
            }
        }

        List<TodayHabitDto> todayHabits = new ArrayList<>();
        for (Habit habit : habits) {
            HabitLog log = todayLogs.get(habit.getId());
            boolean completed = log != null && log.isCompleted();
            String notes = log == null ? null : log.getNotes();
            todayHabits.add(new TodayHabitDto(toHabitDto(habit), completed, notes));
        }

        return new TrackerSummaryDto(
                today,
                todayHabits,
                completedCount,
                totalCount,
                completionRate,
                streak
        );
    }

    @GetMapping("/heatmap")
    public List<HeatmapDayDto> heatmap(
            @RequestParam(name = "from", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(name = "to", required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        LocalDate today = LocalDate.now();
        LocalDate start = from == null ? today.minusDays(364) : from;
        LocalDate end = to == null ? today : to;
        if (end.isBefore(start)) {
            throw new ApiException(400, "The end date must be after the start date.");
        }

        List<Habit> habits = habitRepository.findByUserIdOrderByCreatedAtAscIdAsc(principal.getId());
        List<LocalDate> creationDates = new ArrayList<>();
        for (Habit habit : habits) {
            creationDates.add(habit.getCreatedAt().atZone(ZoneId.systemDefault()).toLocalDate());
        }
        creationDates.sort(LocalDate::compareTo);

        List<HabitLog> logs = habitLogRepository.findByUserIdAndLogDateBetween(principal.getId(), start, end);
        Map<LocalDate, Integer> completedByDay = new HashMap<>();
        for (HabitLog log : logs) {
            if (log.isCompleted()) {
                completedByDay.merge(log.getLogDate(), 1, Integer::sum);
            }
        }

        List<HeatmapDayDto> days = new ArrayList<>();
        for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
            int total = 0;
            for (LocalDate creation : creationDates) {
                if (creation.isAfter(day)) {
                    break;
                }
                total++;
            }
            int completed = completedByDay.getOrDefault(day, 0);
            double ratio = total == 0 ? 0.0 : Math.round((completed * 1000.0) / total) / 1000.0;
            days.add(new HeatmapDayDto(day, completed, total, ratio));
        }
        return days;
    }

    private Habit ownedHabit(Long id, UserPrincipal principal) {
        Habit habit = habitRepository.findById(id)
                .orElseThrow(() -> new ApiException(404, "Habit not found."));
        if (!habit.getUserId().equals(principal.getId())) {
            throw new ApiException(404, "Habit not found.");
        }
        return habit;
    }

    private static HabitDto toHabitDto(Habit habit) {
        return new HabitDto(
                habit.getId(),
                habit.getTitle(),
                habit.getCategory(),
                habit.getSource(),
                habit.getSourceAnalysisId(),
                habit.isActive(),
                habit.getCreatedAt()
        );
    }

    private static HabitLogDto toLogDto(HabitLog log) {
        return new HabitLogDto(
                log.getId(),
                log.getHabitId(),
                log.getLogDate(),
                log.isCompleted(),
                log.getNotes()
        );
    }
}
