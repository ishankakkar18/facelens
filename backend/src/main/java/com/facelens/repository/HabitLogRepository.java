package com.facelens.repository;

import com.facelens.entity.HabitLog;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HabitLogRepository extends JpaRepository<HabitLog, Long> {

    List<HabitLog> findByUserIdAndLogDateBetween(Long userId, LocalDate from, LocalDate to);

    Optional<HabitLog> findByUserIdAndHabitIdAndLogDate(Long userId, Long habitId, LocalDate logDate);

    List<HabitLog> findByUserIdAndLogDate(Long userId, LocalDate logDate);
}
