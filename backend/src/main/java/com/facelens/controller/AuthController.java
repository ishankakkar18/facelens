package com.facelens.controller;

import com.facelens.auth.JwtService;
import com.facelens.auth.UserPrincipal;
import com.facelens.dto.AuthDtos.LoginRequest;
import com.facelens.dto.AuthDtos.RegisterRequest;
import com.facelens.dto.AuthDtos.TokenResponse;
import com.facelens.dto.AuthDtos.UserDto;
import com.facelens.entity.User;
import com.facelens.exception.ApiException;
import com.facelens.repository.UserRepository;
import jakarta.validation.Valid;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    public ResponseEntity<TokenResponse> register(@Valid @RequestBody RegisterRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.findByEmail(email).isPresent()) {
            throw new ApiException(400, "An account with this email already exists.");
        }

        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        userRepository.save(user);

        String token = jwtService.generate(user.getId(), user.getEmail());
        return ResponseEntity.status(HttpStatus.CREATED).body(TokenResponse.of(token, user));
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ApiException(401, "Incorrect email or password."));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ApiException(401, "Incorrect email or password.");
        }

        return TokenResponse.of(jwtService.generate(user.getId(), user.getEmail()), user);
    }

    @GetMapping("/me")
    public UserDto me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new ApiException(401, "Not authenticated");
        }
        return UserDto.from(principal.getUser());
    }
}
