package com.facelens.service;

import com.facelens.exception.ApiException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class RateLimiter {

    private static final int MAX_REQUESTS = 6;
    private static final long WINDOW_MS = 10 * 60 * 1000L;

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    public void check(String ip) {
        long now = System.currentTimeMillis();
        Deque<Long> bucket = hits.computeIfAbsent(ip, key -> new ArrayDeque<>());
        synchronized (bucket) {
            while (!bucket.isEmpty() && now - bucket.peekFirst() > WINDOW_MS) {
                bucket.pollFirst();
            }
            if (bucket.size() >= MAX_REQUESTS) {
                throw new ApiException(429, "Too many analyses. Please wait a few minutes.");
            }
            bucket.addLast(now);
        }
    }
}
