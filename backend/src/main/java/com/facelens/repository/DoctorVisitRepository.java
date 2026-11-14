package com.facelens.repository;

import com.facelens.entity.DoctorVisit;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DoctorVisitRepository extends JpaRepository<DoctorVisit, Long> {

    List<DoctorVisit> findByUserIdOrderByVisitDateDescIdDesc(Long userId);

    Optional<DoctorVisit> findByIdAndUserId(Long id, Long userId);
}
