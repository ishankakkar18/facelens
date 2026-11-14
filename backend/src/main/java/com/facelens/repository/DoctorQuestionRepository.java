package com.facelens.repository;

import com.facelens.entity.DoctorQuestion;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorQuestionRepository extends JpaRepository<DoctorQuestion, Long> {

    List<DoctorQuestion> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<DoctorQuestion> findByIdAndUserId(Long id, Long userId);
}
