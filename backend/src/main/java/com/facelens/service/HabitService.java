package com.facelens.service;

import com.facelens.entity.Habit;
import com.facelens.repository.HabitRepository;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class HabitService {

    private final HabitRepository habitRepository;

    public HabitService(HabitRepository habitRepository) {
        this.habitRepository = habitRepository;
    }

    public List<Habit> createFromAnalysis(Long userId, Long analysisId, Map<String, Object> result) {
        Object suggestionsValue = result.get("suggestions");
        if (!(suggestionsValue instanceof Map<?, ?> suggestions)) {
            return List.of();
        }

        Set<String> existingTitles = new HashSet<>();
        for (Habit habit : habitRepository.findByUserId(userId)) {
            existingTitles.add(habit.getTitle().trim().toLowerCase());
        }

        List<Habit> created = new ArrayList<>();
        for (String category : List.of("skincare", "grooming", "lifestyle", "professional")) {
            Object itemsValue = suggestions.get(category);
            if (!(itemsValue instanceof List<?> items)) {
                continue;
            }
            for (Object item : items) {
                String title = item == null ? "" : item.toString().trim();
                if (title.isBlank() || existingTitles.contains(title.toLowerCase())) {
                    continue;
                }
                Habit habit = new Habit();
                habit.setUserId(userId);
                habit.setTitle(title.length() > 255 ? title.substring(0, 255) : title);
                habit.setCategory(category);
                habit.setSource("ai");
                habit.setSourceAnalysisId(analysisId);
                created.add(habit);
                existingTitles.add(title.toLowerCase());
            }
        }

        if (created.isEmpty()) {
            return created;
        }
        return habitRepository.saveAll(created);
    }
}
