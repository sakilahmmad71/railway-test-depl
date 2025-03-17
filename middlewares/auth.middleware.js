import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { isTokenBlacklisted } from "../controllers/auth.controller.js";
import { User } from "../model/user.model.js";

dotenv.config();

/**
 * Authentication middleware to protect routes
 * This middleware validates the JWT token and attaches the user to the request object
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 * @returns {void}
 */
const authorize = async (req, res, next) => {
    try {
        // Extract token from headers or cookies
        let token;

        // Check Authorization header (Bearer token)
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer")
        ) {
            // Split at the space and take the token part
            // Format: "Bearer eyJhbGciOiJIUzI1NiIsIn..."
            token = req.headers.authorization.split(" ")[1].trim();
        }

        // No token found
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please log in.",
            });
        }

        // Check if token is blacklisted (user has logged out)
        if (isTokenBlacklisted(token)) {
            return res.status(401).json({
                success: false,
                message: "Session has been invalidated. Please log in again.",
            });
        }

        try {
            // Verify token and extract payload
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Check for required fields in token
            if (!decoded.userId) {
                throw new Error("Invalid token structure");
            }

            // Retrieve user from database (excluding password)
            const user = await User.findByPk(decoded.userId, {
                attributes: { exclude: ["password"] },
            });

            // User not found in database
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "User no longer exists. Please register again.",
                });
            }

            // Set user info on request object
            req.user = user;
            next();
        } catch (jwtError) {
            // Handle different JWT error types
            if (jwtError.name === "TokenExpiredError") {
                return res.status(401).json({
                    success: false,
                    message: "Your session has expired. Please log in again.",
                });
            } else if (jwtError.name === "JsonWebTokenError") {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid authentication token. Please log in again.",
                });
            } else {
                // Other JWT errors
                return res.status(401).json({
                    success: false,
                    message: "Authentication failed. Please log in again.",
                });
            }
        }
    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({
            success: false,
            message: "Server authentication error",
        });
    }
};

export default authorize;
