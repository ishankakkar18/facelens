package com.facelens.repository;

import com.facelens.entity.Dermatologist;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface DermatologistRepository extends JpaRepository<Dermatologist, Long> {

    List<Dermatologist> findAllByOrderByCityAscNameAsc();

    List<Dermatologist> findByCityContainingIgnoreCaseOrderByCityAscNameAsc(String city);

    @Query("select distinct d.city from Dermatologist d order by d.city asc")
    List<String> findDistinctCities();
}
