package com.facelens.repository;

import com.facelens.entity.ProgressPhoto;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProgressPhotoRepository extends JpaRepository<ProgressPhoto, Long> {

    List<ProgressPhoto> findByUserIdOrderByPhotoDateDescIdDesc(Long userId);

    Optional<ProgressPhoto> findByIdAndUserId(Long id, Long userId);
}
