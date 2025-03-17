import crypto from "crypto";
import fs from "fs";
import multer from "multer";
import path from "path";

/**
 * File upload configuration and middleware
 * Handles profile picture uploads with secure file naming,
 * type validation, and error handling
 */

// Define upload directory paths
const uploadDir = "./uploads";
const profilePicturesDir = "./uploads/profile-pictures";

// Ensure upload directories exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(profilePicturesDir)) {
    fs.mkdirSync(profilePicturesDir, { recursive: true });
}

// Allowed file types for user profile pictures
const ALLOWED_FILE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
];
// Maximum file size in bytes (2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Configure storage options for uploaded files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, profilePicturesDir);
    },
    filename: function (req, file, cb) {
        // Generate a secure random filename to prevent path traversal attacks
        // and potential filename collisions
        const randomString = crypto.randomBytes(16).toString("hex");
        const timestamp = Date.now();

        // Get safe file extension
        const fileExtension = path.extname(file.originalname).toLowerCase();

        // Create final filename: profile-{timestamp}-{randomString}.ext
        cb(null, `profile-${timestamp}-${randomString}${fileExtension}`);
    },
});

/**
 * File filter to validate uploaded files
 * Ensures only allowed image types are accepted
 */
const fileFilter = (req, file, cb) => {
    // Check if the file type is in our allowed list
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                `Only ${ALLOWED_FILE_TYPES.join(", ")} files are allowed`
            ),
            false
        );
    }
};

// Create multer upload instance with our configuration
const upload = multer({
    storage: storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
    },
    fileFilter: fileFilter,
});

/**
 * Middleware for handling profile picture uploads
 * Uses single() to capture one file with field name "profilePicture"
 */
export const uploadProfilePicture = upload.single("profilePicture");

/**
 * Error handler middleware for multer upload errors
 * Provides user-friendly error messages for common upload issues
 */
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Handle multer-specific errors
        switch (err.code) {
            case "LIMIT_FILE_SIZE":
                return res.status(400).json({
                    success: false,
                    message: `File size too large. Maximum size is ${
                        MAX_FILE_SIZE / (1024 * 1024)
                    }MB.`,
                });
            case "LIMIT_UNEXPECTED_FILE":
                return res.status(400).json({
                    success: false,
                    message:
                        "Unexpected file upload field. Please use 'profilePicture' field.",
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: `Upload error: ${err.message}`,
                });
        }
    } else if (err) {
        // Handle other errors that might occur during upload
        return res.status(400).json({
            success: false,
            message: err.message || "Error uploading file",
        });
    }

    // If no errors, proceed to next middleware
    next();
};

export default { uploadProfilePicture, handleMulterError };
