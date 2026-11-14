package com.facelens.service;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class StorageService {

    private final Path uploadRoot;
    private final String r2Bucket;
    private final String r2PublicBaseUrl;
    private final S3Client s3Client;

    public StorageService(
            @Value("${app.storage.upload-dir:uploads}") String uploadDir,
            @Value("${app.r2.account-id:}") String accountId,
            @Value("${app.r2.access-key-id:}") String accessKeyId,
            @Value("${app.r2.secret-access-key:}") String secretAccessKey,
            @Value("${app.r2.bucket:}") String r2Bucket,
            @Value("${app.r2.public-base-url:}") String r2PublicBaseUrl
    ) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.r2Bucket = r2Bucket;
        this.r2PublicBaseUrl = r2PublicBaseUrl == null ? "" : r2PublicBaseUrl.trim();
        try {
            Files.createDirectories(uploadRoot.resolve("faces"));
        } catch (IOException exception) {
            throw new IllegalStateException("Could not create upload directory", exception);
        }

        boolean r2Configured = !accountId.isBlank()
                && !accessKeyId.isBlank()
                && !secretAccessKey.isBlank()
                && !r2Bucket.isBlank();

        if (r2Configured) {
            this.s3Client = S3Client.builder()
                    .endpointOverride(URI.create("https://" + accountId + ".r2.cloudflarestorage.com"))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
                    .region(Region.of("auto"))
                    .build();
        } else {
            this.s3Client = null;
        }
    }

    public String upload(byte[] data, String contentType) {
        String extension = switch (contentType) {
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> "jpg";
        };
        String key = "faces/" + UUID.randomUUID().toString().replace("-", "") + "." + extension;

        if (s3Client != null) {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(r2Bucket)
                            .key(key)
                            .contentType(contentType)
                            .build(),
                    RequestBody.fromBytes(data)
            );
            if (!r2PublicBaseUrl.isBlank()) {
                return stripTrailingSlash(r2PublicBaseUrl) + "/" + key;
            }
            return key;
        }

        Path destination = uploadRoot.resolve(key);
        try {
            Files.createDirectories(destination.getParent());
            Files.write(destination, data);
        } catch (IOException exception) {
            throw new IllegalStateException("Could not store uploaded image", exception);
        }
        return "/uploads/" + key;
    }

    public void delete(String imageUrl) {
        if (imageUrl == null || imageUrl.isBlank()) {
            return;
        }

        if (s3Client != null) {
            String key = imageUrl;
            if (!r2PublicBaseUrl.isBlank()) {
                String prefix = stripTrailingSlash(r2PublicBaseUrl) + "/";
                if (imageUrl.startsWith(prefix)) {
                    key = imageUrl.substring(prefix.length());
                }
            }
            if (key.startsWith("/uploads/")) {
                key = key.substring("/uploads/".length());
            }
            try {
                s3Client.deleteObject(DeleteObjectRequest.builder().bucket(r2Bucket).key(key).build());
            } catch (RuntimeException ignored) {
                // Best-effort cleanup.
            }
            return;
        }

        if (imageUrl.startsWith("/uploads/")) {
            Path path = uploadRoot.resolve(imageUrl.substring("/uploads/".length())).normalize();
            if (path.startsWith(uploadRoot)) {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Best-effort cleanup.
                }
            }
        }
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
