import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { User, userValidation } from "../model/user.model.js";

export const getUsers = async (req, res, next) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const offset = (page - 1) * limit;

		const { count: totalUsers, rows: users } = await User.findAndCountAll({
			attributes: {
				exclude: ["password", "refreshToken", "tokenVersion"],
			},
			limit: limit,
			offset: offset,
			order: [["created_at", "DESC"]],
		});

		// Add profile picture URLs for each user
		const usersWithProfilePicUrl = users.map((user) => {
			const userData = user.toJSON();
			userData.profilePictureUrl = `/api/v1/users/${user.id}/profile-picture`;
			return userData;
		});

		res.status(200).json({
			success: true,
			message: "Users fetched successfully",
			data: usersWithProfilePicUrl,
			pagination: {
				total: totalUsers,
				limit: limit,
				totalPages: Math.ceil(totalUsers / limit),
				currentPage: page,
				hasNextPage: offset + limit < totalUsers,
				hasPreviousPage: page > 1,
				nextPage: offset + limit < totalUsers ? page + 1 : null,
				previousPage: page > 1 ? page - 1 : null,
			},
		});
	} catch (error) {
		next(error);
	}
};

export const getUserById = async (req, res, next) => {
	try {
		const userId = req.params.id;

		const user = await User.findByPk(userId, {
			attributes: {
				exclude: ["password", "refreshToken", "tokenVersion"],
			},
		});

		if (!user) {
			const error = new Error("User not found");
			error.statusCode = 404;
			throw error;
		}

		// Add profile picture URL
		const userData = user.toJSON();
		userData.profilePictureUrl = `/api/v1/users/${user.id}/profile-picture`;

		res.status(200).json({
			success: true,
			message: "User fetched successfully",
			data: userData,
		});
	} catch (error) {
		next(error);
	}
};

// Get own profile - requires authentication
export const getProfile = async (req, res, next) => {
	try {
		// req.user is set by the authorize middleware
		const userId = req.user.id;

		const user = await User.findByPk(userId, {
			attributes: {
				exclude: ["password", "refreshToken", "tokenVersion"],
			},
		});

		if (!user) {
			const error = new Error("User not found");
			error.statusCode = 404;
			throw error;
		}

		// Add profile picture URL
		const userData = user.toJSON();
		userData.profilePictureUrl = `/api/v1/users/${user.id}/profile-picture`;

		res.status(200).json({
			success: true,
			message: "Profile fetched successfully",
			data: userData,
		});
	} catch (error) {
		next(error);
	}
};

// Update own profile - requires authentication
export const updateProfile = async (req, res, next) => {
	try {
		// Validate request body using Joi
		const { error } = userValidation.updateProfile.validate(req.body);
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const userId = req.user.id;
		const { name, email, bio, location } = req.body;

		// Check if user exists
		const user = await User.findByPk(userId);
		if (!user) {
			const error = new Error("User not found");
			error.statusCode = 404;
			throw error;
		}

		// If email is being changed, check if it's already taken
		if (email && email !== user.email) {
			const existingUser = await User.findOne({
				where: { email },
			});

			if (existingUser) {
				return res.status(409).json({
					success: false,
					message: "Email already in use",
				});
			}
		}

		// Prepare update data
		const updateData = {
			name: name || user.name,
			email: email || user.email,
			bio: bio !== undefined ? bio : user.bio,
			location: location !== undefined ? location : user.location,
		};

		// If profile picture was uploaded (handled by multer middleware)
		if (req.file) {
			// Delete the old profile picture if it exists
			if (user.profilePicture) {
				try {
					const oldPicturePath = path.join(
						process.cwd(),
						user.profilePicture
					);
					if (fs.existsSync(oldPicturePath)) {
						fs.unlinkSync(oldPicturePath);
					}
				} catch (err) {
					console.error("Error deleting old profile picture:", err);
					// Continue with update even if old file deletion fails
				}
			}

			// Save the new profile picture path relative to server root
			updateData.profilePicture = req.file.path.replace(/\\/g, "/");
		}

		// Update user
		await user.update(updateData);

		// Return updated user without sensitive information
		const updatedUser = await User.findByPk(userId, {
			attributes: {
				exclude: ["password", "refreshToken", "tokenVersion"],
			},
		});

		// Add profile picture URL
		const userData = updatedUser.toJSON();
		userData.profilePictureUrl = `/api/v1/users/${updatedUser.id}/profile-picture`;

		res.status(200).json({
			success: true,
			message: "Profile updated successfully",
			data: userData,
		});
	} catch (error) {
		next(error);
	}
};

// Add YouTube link to profile - requires authentication
export const addYoutubeLink = async (req, res, next) => {
	try {
		// Validate request body using Joi
		const { error } = userValidation.addYoutubeLink.validate(req.body);
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		const userId = req.user.id;
		const { youtubeUrl, title } = req.body;

		// Check if user exists
		const user = await User.findByPk(userId);
		if (!user) {
			const error = new Error("User not found");
			error.statusCode = 404;
			throw error;
		}

		// Parse current YouTube links
		const currentLinks = user.youtubeLinks || [];

		// Add new link
		const newLink = {
			id: Date.now().toString(), // Simple unique ID
			url: youtubeUrl,
			title,
			addedAt: new Date().toISOString(),
		};

		// Update user's YouTube links
		await user.update({
			youtubeLinks: [...currentLinks, newLink],
		});

		// Return updated user without sensitive information
		const updatedUser = await User.findByPk(userId, {
			attributes: {
				exclude: ["password", "refreshToken", "tokenVersion"],
			},
		});

		// Add profile picture URL
		const userData = updatedUser.toJSON();
		userData.profilePictureUrl = `/api/v1/users/${updatedUser.id}/profile-picture`;

		res.status(201).json({
			success: true,
			message: "YouTube link added successfully",
			data: {
				newLink,
				user: userData,
			},
		});
	} catch (error) {
		next(error);
	}
};

// Remove YouTube link from profile - requires authentication
export const removeYoutubeLink = async (req, res, next) => {
	try {
		const userId = req.user.id;
		const linkId = req.params.linkId;

		// Check if user exists
		const user = await User.findByPk(userId);
		if (!user) {
			const error = new Error("User not found");
			error.statusCode = 404;
			throw error;
		}

		// Parse current YouTube links
		const currentLinks = user.youtubeLinks || [];

		// Filter out the link to remove
		const updatedLinks = currentLinks.filter((link) => link.id !== linkId);

		// Check if link was found and removed
		if (currentLinks.length === updatedLinks.length) {
			return res.status(404).json({
				success: false,
				message: "YouTube link not found",
			});
		}

		// Update user's YouTube links
		await user.update({
			youtubeLinks: updatedLinks,
		});

		// Return updated user without sensitive information
		const updatedUser = await User.findByPk(userId, {
			attributes: {
				exclude: ["password", "refreshToken", "tokenVersion"],
			},
		});

		// Add profile picture URL
		const userData = updatedUser.toJSON();
		userData.profilePictureUrl = `/api/v1/users/${updatedUser.id}/profile-picture`;

		res.status(200).json({
			success: true,
			message: "YouTube link removed successfully",
			data: userData,
		});
	} catch (error) {
		next(error);
	}
};

// Get profile picture
export const getProfilePicture = async (req, res, next) => {
	try {
		const userId = req.params.id;

		// Set explicit CORS headers with dynamic origin
		const allowedOrigins = [
			"http://localhost:3005",
			"http://localhost:3005",
			"https://csmbd-assignment-frontend.vercel.app",
		];

		const origin = req.headers.origin;
		if (origin && allowedOrigins.includes(origin)) {
			res.setHeader("Access-Control-Allow-Origin", origin);
		} else {
			// Default to first allowed origin if no valid origin in request
			res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
		}

		res.setHeader("Access-Control-Allow-Methods", "GET");
		res.setHeader(
			"Access-Control-Allow-Headers",
			"Content-Type, Authorization"
		);
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
		res.setHeader("Timing-Allow-Origin", "*");

		// Find the user to get their profile picture path
		const user = await User.findByPk(userId, {
			attributes: ["profilePicture"],
		});

		if (!user) {
			return res.status(404).json({
				success: false,
				message: "User not found",
			});
		}

		// Determine which file to send
		let filePath;
		if (!user.profilePicture) {
			filePath = path.join(
				process.cwd(),
				"uploads",
				"profile-pictures",
				"default.png"
			);
		} else {
			filePath = path.join(process.cwd(), user.profilePicture);
		}

		// Check if the file exists
		if (!fs.existsSync(filePath)) {
			return res.status(404).json({
				success: false,
				message: "Profile picture not found",
			});
		}

		// Determine the content type based on file extension
		const ext = path.extname(filePath).toLowerCase();
		let contentType = "application/octet-stream"; // Default

		switch (ext) {
			case ".jpg":
			case ".jpeg":
				contentType = "image/jpeg";
				break;
			case ".png":
				contentType = "image/png";
				break;
			case ".gif":
				contentType = "image/gif";
				break;
			case ".webp":
				contentType = "image/webp";
				break;
			case ".svg":
				contentType = "image/svg+xml";
				break;
		}

		// Read and stream the file manually to ensure CORS headers are sent
		const fileStream = fs.createReadStream(filePath);
		res.setHeader("Content-Type", contentType);
		res.setHeader("Cache-Control", "public, max-age=86400"); // 24 hour cache

		// Stream the file to the response
		fileStream.pipe(res);

		// Handle stream errors
		fileStream.on("error", (error) => {
			next(error);
		});
	} catch (error) {
		next(error);
	}
};

// Get all content (YouTube links) from all users for the homepage
export const getAllContent = async (req, res, next) => {
	try {
		// Validate query parameters
		const { error } = userValidation.getAllContent.validate(req.query);
		if (error) {
			return res.status(400).json({
				success: false,
				message: error.details[0].message,
			});
		}

		// Parse query parameters with validation
		const page = Math.max(1, parseInt(req.query.page) || 1); // Default to page 1, minimum 1
		const limit = Math.min(
			50,
			Math.max(1, parseInt(req.query.limit) || 10)
		); // Default 10, minimum 1, maximum 50
		const sortBy = ["newest", "oldest", "popular"].includes(
			req.query.sortBy
		)
			? req.query.sortBy
			: "newest"; // Default to newest

		// Performance optimization: Only retrieve users with YouTube links
		// This uses the database to filter instead of fetching all users and filtering in memory
		// Note: A database index on youtube_links would improve this query's performance
		const users = await User.findAll({
			attributes: ["id", "name", "youtubeLinks"],
			where: {
				// Only select users who have at least one YouTube link
				youtubeLinks: {
					[Op.not]: null,
					[Op.ne]: "[]", // Not an empty array
				},
			},
			// Optimization: Add order by created_at for consistent results
			order: [["created_at", "DESC"]],
		});

		// Extract and format all YouTube links with user information
		// Performance optimization: Pre-allocate array with estimated size
		const estimatedContentCount = users.reduce(
			(count, user) => count + (user.youtubeLinks?.length || 0),
			0
		);
		let allContent = new Array(estimatedContentCount);
		let contentIndex = 0;

		// Process all users' content in a single pass
		users.forEach((user) => {
			const userData = user.toJSON();
			if (userData.youtubeLinks && userData.youtubeLinks.length > 0) {
				userData.youtubeLinks.forEach((link) => {
					// Security: Ensure all expected properties exist
					if (!link.id || !link.url) {
						return; // Skip invalid entries
					}

					allContent[contentIndex++] = {
						id: link.id,
						title: link.title || "Untitled Video", // Provide fallback for missing titles
						url: link.url,
						addedAt: link.addedAt || new Date().toISOString(), // Provide fallback for missing dates
						user: {
							id: userData.id,
							name: userData.name,
							profilePictureUrl: `/api/v1/users/${userData.id}/profile-picture`,
						},
					};
				});
			}
		});

		// Trim array to actual size if pre-allocation estimate was off
		allContent = allContent.filter(Boolean);

		// Optimization: Apply sorting efficiently
		const getSortFn = (sortType) => {
			// Use optimized sorting functions based on type
			switch (sortType) {
				case "newest":
					return (a, b) => new Date(b.addedAt) - new Date(a.addedAt);
				case "oldest":
					return (a, b) => new Date(a.addedAt) - new Date(b.addedAt);
				case "popular":
					// This is a placeholder for popularity sorting
					// TODO: Implement proper popularity metric when available
					return (a, b) => new Date(b.addedAt) - new Date(a.addedAt);
				default:
					return (a, b) => new Date(b.addedAt) - new Date(a.addedAt);
			}
		};

		// Sort the content array
		allContent.sort(getSortFn(sortBy));

		// Calculate pagination efficiently
		const total = allContent.length;
		const totalPages = Math.ceil(total / limit);
		const startIndex = (page - 1) * limit;
		const endIndex = Math.min(startIndex + limit, total);

		// Get the content for the current page
		const paginatedContent = allContent.slice(startIndex, endIndex);

		// Return with proper cacheing headers if data hasn't changed
		// Note: In production, you should implement proper cache control
		// using ETags or Last-Modified headers
		res.status(200).json({
			success: true,
			message: "Content fetched successfully",
			data: paginatedContent,
			pagination: {
				total,
				limit,
				totalPages,
				currentPage: page,
				hasNextPage: endIndex < total,
				hasPreviousPage: page > 1,
				nextPage: endIndex < total ? page + 1 : null,
				previousPage: page > 1 ? page - 1 : null,
			},
		});
	} catch (error) {
		console.error("Error fetching content:", error);
		next(error);
	}
};
