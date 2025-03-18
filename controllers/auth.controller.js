import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { User, userValidation } from "../model/user.model.js";

dotenv.config();

// In-memory blacklist for invalidated tokens (DEVELOPMENT ONLY)
const tokenBlacklist = new Set();

// Helper to extract token
const extractToken = (req) => {
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		return req.headers.authorization.split(" ")[1].trim();
	}
	return null;
};

/**
 * Generate tokens for authentication (access + refresh)
 *
 * @param {Object} user - User object from database
 * @returns {Object} Object containing access and refresh tokens
 */
const generateTokens = async (user) => {
	// Create access token with short lifetime
	const accessToken = jwt.sign({ userId: user.id }, "04058abefa84d9a7109e55111830e7e1d01474d8d10e667b8d1b9ba38b55447c", {
		expiresIn: "1d",
	});

	// Create refresh token with longer lifetime and include token version
	const refreshToken = jwt.sign(
		{
			userId: user.id,
			version: user.tokenVersion,
		},
		"04058abefa84d9a7109e55111830e7e1d01474d8d10e667b8d1b9ba38b55447c",
		{ expiresIn: "7d" }
	);

	// Store refresh token in database
	user.refreshToken = refreshToken;
	await user.save();

	return { accessToken, refreshToken };
};

export const signUp = async (req, res) => {
	try {
		// Validate request body using Joi
		const { error } = userValidation.register.validate(req.body);
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const { name, email, password } = req.body;

		// First check if user exists OUTSIDE of any transaction
		const existingUser = await User.findOne({
			where: { email },
		});

		if (existingUser) {
			return res.status(409).json({
				success: false,
				message: "User already exists",
			});
		}

		// Create user without transaction
		const newUser = await User.create({ name, email, password });

		// Generate tokens
		const { accessToken, refreshToken } = await generateTokens(newUser);

		// Remove password from response
		const userWithoutPassword = newUser.toJSON();
		delete userWithoutPassword.password;
		delete userWithoutPassword.refreshToken; // Don't send refreshToken in user object

		return res.status(201).json({
			success: true,
			message: "User created successfully",
			data: {
				accessToken,
				refreshToken,
				user: userWithoutPassword,
			},
		});
	} catch (error) {
		console.error("Signup error:", error.message);

		return res.status(500).json({
			success: false,
			message: error.message || "Failed to create user",
		});
	}
};

export const signIn = async (req, res) => {
	try {
		// Validate request body using Joi
		const { error } = userValidation.login.validate(req.body);
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const { email, password } = req.body;

		// Find user by email - using Sequelize's findOne
		const user = await User.findOne({
			where: { email },
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// Use the comparePassword method we defined in the model
		const isPasswordCorrect = await user.comparePassword(password);
		if (!isPasswordCorrect) {
			return res.status(401).json({
				success: false,
				message: "Invalid password",
			});
		}

		// Generate tokens
		const { accessToken, refreshToken } = await generateTokens(user);

		// Remove password from response using Sequelize's toJSON
		const userWithoutPassword = user.toJSON();
		delete userWithoutPassword.password;
		delete userWithoutPassword.refreshToken; // Don't send refreshToken in user object

		res.status(200).json({
			success: true,
			message: "User signed in successfully",
			data: {
				accessToken,
				refreshToken,
				user: userWithoutPassword,
			},
		});
	} catch (error) {
		console.error("Login error:", error.message);

		res.status(500).json({
			success: false,
			message: error.message || "Failed to sign in",
		});
	}
};

/**
 * Refresh the access token using a valid refresh token
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const refreshToken = async (req, res) => {
	try {
		const { refreshToken } = req.body;

		if (!refreshToken) {
			return res.status(400).json({
				success: false,
				message: "Refresh token is required",
			});
		}

		// Verify the refresh token
		let decoded;
		try {
			decoded = jwt.verify(refreshToken, "04058abefa84d9a7109e55111830e7e1d01474d8d10e667b8d1b9ba38b55447c");
		} catch {
			return res.status(401).json({
				success: false,
				message: "Invalid or expired refresh token",
			});
		}

		// Find the user
		const user = await User.findByPk(decoded.userId);

		// Validate user exists and token matches stored token
		if (!user || user.refreshToken !== refreshToken) {
			return res.status(401).json({
				success: false,
				message: "Invalid refresh token",
			});
		}

		// Validate token version (protection against stolen refresh tokens)
		if (decoded.version !== user.tokenVersion) {
			return res.status(401).json({
				success: false,
				message: "Token version mismatch. Please login again.",
			});
		}

		// Generate a new access token
		const accessToken = jwt.sign(
			{ userId: user.id },
			"04058abefa84d9a7109e55111830e7e1d01474d8d10e667b8d1b9ba38b55447c",
			{
				expiresIn: "1d",
			}
		);

		// Return the new access token
		return res.status(200).json({
			success: true,
			message: "Token refreshed successfully",
			data: {
				accessToken,
			},
		});
	} catch (error) {
		console.error("Refresh token error:", error.message);
		return res.status(500).json({
			success: false,
			message: "Failed to refresh token",
		});
	}
};

/**
 * Sign out a user by invalidating their JWT token
 *
 * This implementation:
 * 1. Blacklists the current access token
 * 2. Invalidates the refresh token in the database
 * 3. Increments the token version to invalidate any other refresh tokens
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const signOut = async (req, res) => {
	try {
		// Extract the token from the Authorization header
		const token = extractToken(req);

		if (token) {
			// Add the access token to blacklist
			tokenBlacklist.add(token);

			// Get token expiry to know how long to keep it in blacklist
			try {
				const decoded = jwt.verify(token, "04058abefa84d9a7109e55111830e7e1d01474d8d10e667b8d1b9ba38b55447c");
				const expiryTimestamp = decoded.exp;

				// Remove from blacklist after expiry
				// This is to prevent the blacklist from growing indefinitely
				setTimeout(() => {
					tokenBlacklist.delete(token);
				}, expiryTimestamp * 1000 - Date.now());

				// If we have a user ID, invalidate their refresh token
				if (decoded.userId && req.user) {
					const user = await User.findByPk(decoded.userId);

					if (user) {
						// Increment token version to invalidate all refresh tokens
						user.tokenVersion += 1;
						// Clear refresh token
						user.refreshToken = null;
						await user.save();
					}
				}
			} catch {
				// If token is invalid, no need to blacklist
				console.log("Invalid token provided for logout");
			}
		}

		res.status(200).json({
			success: true,
			message: "User signed out successfully",
		});
	} catch (error) {
		console.error("Logout error:", error.message);
		res.status(500).json({
			success: false,
			message: "Failed to sign out",
		});
	}
};

// Export the blacklist to be used in auth middleware
export const isTokenBlacklisted = (token) => {
	return tokenBlacklist.has(token);
};
