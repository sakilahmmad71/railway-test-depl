import { Router } from "express";
import {
    addYoutubeLink,
    getAllContent,
    getProfile,
    getProfilePicture,
    getUserById,
    getUsers,
    removeYoutubeLink,
    updateProfile,
} from "../controllers/user.controller.js";
import authorize from "../middlewares/auth.middleware.js";
import corsMiddleware from "../middlewares/cors.middleware.js";
import {
    handleMulterError,
    uploadProfilePicture,
} from "../middlewares/upload.middleware.js";

/**
 * User Routes Configuration
 *
 * IMPORTANT: Route order matters in Express!
 * More specific routes should come before dynamic routes with path parameters.
 * For example, '/content' must be defined before '/:id' to avoid treating 'content' as an ID.
 */
const userRouter = Router();

// Public routes - Visitor Access

// Get all users with pagination
userRouter.get("/", getUsers);

// Get all content (YouTube links) from all users for homepage
// NOTE: This must come BEFORE the /:id route to prevent 'content' being treated as an ID
userRouter.get("/content", getAllContent);

// Get specific user by ID
userRouter.get("/:id", getUserById);

// Get user's profile picture
userRouter.get("/:id/profile-picture", corsMiddleware, getProfilePicture);

// Protected routes - User Profile Management

// Get own profile
userRouter.get("/profile/me", authorize, getProfile);

// Update own profile (with profile picture upload)
userRouter.put(
    "/profile/me",
    authorize,
    uploadProfilePicture,
    handleMulterError,
    updateProfile
);

// Add YouTube link to profile
userRouter.post("/profile/youtube", authorize, addYoutubeLink);

// Remove YouTube link from profile
userRouter.delete("/profile/youtube/:linkId", authorize, removeYoutubeLink);

export default userRouter;
