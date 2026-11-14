package com.facelens.config;

import com.facelens.entity.Dermatologist;
import com.facelens.repository.DermatologistRepository;
import java.util.List;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final DermatologistRepository dermatologistRepository;

    public DataInitializer(DermatologistRepository dermatologistRepository) {
        this.dermatologistRepository = dermatologistRepository;
    }

    @Override
    public void run(String... args) {
        if (dermatologistRepository.count() > 0) {
            return;
        }
        dermatologistRepository.saveAll(List.of(
                doctor("Dr. A. Sharma (sample)", "Bengaluru", "Dermatology, acne & pigmentation",
                        "+91-00000-00001", "Indiranagar, Bengaluru"),
                doctor("Dr. R. Iyer (sample)", "Bengaluru", "Cosmetic dermatology",
                        "+91-00000-00002", "Koramangala, Bengaluru"),
                doctor("Dr. P. Mehta (sample)", "Mumbai", "Clinical dermatology",
                        "+91-00000-00003", "Bandra West, Mumbai"),
                doctor("Dr. S. Khan (sample)", "Delhi", "Dermatology, hair & scalp",
                        "+91-00000-00004", "Hauz Khas, New Delhi"),
                doctor("Dr. N. Rao (sample)", "Hyderabad", "Dermatology, eczema & sensitive skin",
                        "+91-00000-00005", "Jubilee Hills, Hyderabad"),
                doctor("Dr. K. Patel (sample)", "Pune", "Dermatology & skin allergies",
                        "+91-00000-00006", "Kothrud, Pune"),
                doctor("Dr. V. Nair (sample)", "Chennai", "Dermatology, pigmentation",
                        "+91-00000-00007", "Adyar, Chennai")
        ));
    }

    private static Dermatologist doctor(String name, String city, String specialty, String phone, String address) {
        Dermatologist dermatologist = new Dermatologist();
        dermatologist.setName(name);
        dermatologist.setCity(city);
        dermatologist.setSpecialty(specialty);
        dermatologist.setPhone(phone);
        dermatologist.setAddress(address);
        return dermatologist;
    }
}
