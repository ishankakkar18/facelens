package com.facelens.repository;

import com.facelens.entity.Analysis;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnalysisRepository extends JpaRepository<Analysis, Long> {

    Optional<Analysis> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    List<Analysis> findTop2ByUserIdOrderByCreatedAtDescIdDesc(Long userId);

    @Query(value = "SELECT * FROM analyses WHERE user_id = :userId ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset",
            nativeQuery = true)
    List<Analysis> findPage(@Param("userId") Long userId, @Param("limit") int limit, @Param("offset") int offset);
}
