package com.facelens.service;

import com.facelens.entity.Habit;
import com.facelens.repository.HabitRepository;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class HabitService {

    private final HabitRepository habitRepository;

    public HabitService(HabitRepository habitRepository) {
        this.habitRepository = habitRepository;
    }

    public record RoutineSyncResult(int added, int updated, int paused) {
    }

    private record RoutineStep(String title, String timeOfDay, String category) {
    }

    /**
     * Turns the latest image analysis into the user's routine.
     * New steps are added, matching AI habits are refreshed, and AI habits that are no
     * longer recommended are paused (never deleted). Custom habits are left untouched.
     */
    public RoutineSyncResult syncRoutineFromAnalysis(Long userId, Long analysisId, Map<String, Object> result) {
        List<Habit> existingHabits = habitRepository.findByUserId(userId);
        Map<String, Habit> byTitle = new HashMap<>();
        for (Habit habit : existingHabits) {
            byTitle.put(normalize(habit.getTitle()), habit);
        }

        String reason = text(result, "biggest_issue");
        if (reason == null || reason.isBlank()) {
            reason = text(result, "clinical_impression");
        }
        if (reason != null && reason.length() > 500) {
            reason = reason.substring(0, 500);
        }

        List<RoutineStep> steps = routineSteps(result);
        Set<String> routineTitles = new LinkedHashSet<>();
        List<Habit> changed = new ArrayList<>();
        int added = 0;
        int updated = 0;

        for (RoutineStep step : steps) {
            String title = step.title().trim();
            if (title.isBlank()) {
                continue;
            }
            if (title.length() > 255) {
                title = title.substring(0, 255);
            }
            String key = normalize(title);
            if (!routineTitles.add(key)) {
                continue;
            }

            Habit habit = byTitle.get(key);
            if (habit == null) {
                habit = new Habit();
                habit.setUserId(userId);
                habit.setTitle(title);
                habit.setCategory(step.category());
                habit.setSource("ai");
                habit.setSourceAnalysisId(analysisId);
                habit.setTimeOfDay(step.timeOfDay());
                habit.setReason(reason);
                habit.setActive(true);
                byTitle.put(key, habit);
                changed.add(habit);
                added++;
            } else {
                // Update both AI and matching custom habits so the whole routine is image-driven.
                habit.setTimeOfDay(step.timeOfDay());
                habit.setReason(reason);
                habit.setActive(true);
                if ("ai".equalsIgnoreCase(habit.getSource())) {
                    habit.setSourceAnalysisId(analysisId);
                }
                changed.add(habit);
                updated++;
            }
        }

        int paused = 0;
        for (Habit habit : existingHabits) {
            boolean routineManaged = "ai".equalsIgnoreCase(habit.getSource()) || habit.getReason() != null;
            if (routineManaged
                    && habit.isActive()
                    && !routineTitles.contains(normalize(habit.getTitle()))) {
                habit.setActive(false);
                changed.add(habit);
                paused++;
            }
        }

        if (!changed.isEmpty()) {
            habitRepository.saveAll(changed);
        }
        return new RoutineSyncResult(added, updated, paused);
    }

    private static List<RoutineStep> routineSteps(Map<String, Object> result) {
        Map<String, Object> routine = asMap(result.get("routine"));
        List<RoutineStep> steps = new ArrayList<>();
        addSteps(steps, routine.get("am"), "morning", "skincare");
        addSteps(steps, routine.get("pm"), "evening", "skincare");
        addSteps(steps, routine.get("weekly"), "weekly", "skincare");

        if (steps.isEmpty()) {
            Map<String, Object> suggestions = asMap(result.get("suggestions"));
            addSteps(steps, suggestions.get("skincare"), "anytime", "skincare");
            addSteps(steps, suggestions.get("grooming"), "anytime", "grooming");
            addSteps(steps, suggestions.get("lifestyle"), "anytime", "lifestyle");
            addSteps(steps, suggestions.get("professional"), "anytime", "professional");
        }
        return steps;
    }

    private static void addSteps(List<RoutineStep> steps, Object value, String timeOfDay, String category) {
        if (!(value instanceof List<?> items)) {
            return;
        }
        for (Object item : items) {
            String title = item == null ? "" : item.toString().trim();
            if (!title.isBlank()) {
                steps.add(new RoutineStep(title, timeOfDay, category));
            }
        }
    }

    private static String normalize(String title) {
        return title == null ? "" : title.trim().toLowerCase(Locale.ROOT);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?>) {
            return (Map<String, Object>) value;
        }
        return Map.of();
    }

    private static String text(Map<String, Object> map, String key) {
        Object value = map.get(key);
        return value == null ? null : value.toString();
    }
}
