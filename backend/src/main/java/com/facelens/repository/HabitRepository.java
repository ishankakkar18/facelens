package com.facelens.repository;

import com.facelens.entity.Habit;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitRepository extends JpaRepository<Habit, Long> {

    List<Habit> findByUserIdOrderByCreatedAtAscIdAsc(Long userId);

    List<Habit> findByUserIdAndActiveTrueOrderByCreatedAtAscIdAsc(Long userId);

    List<Habit> findByUserId(Long userId);
}
