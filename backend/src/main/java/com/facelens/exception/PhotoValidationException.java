package com.facelens.exception;

import java.util.Map;

public class PhotoValidationException extends RuntimeException {

    private final Map<String, String> photoErrors;

    public PhotoValidationException(String message, Map<String, String> photoErrors) {
        super(message);
        this.photoErrors = photoErrors;
    }

    public Map<String, String> getPhotoErrors() {
        return photoErrors;
    }
}
