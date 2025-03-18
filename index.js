import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import connectDB, { sequelize } from "./database/postgresql.js";
import corsMiddleware from "./middlewares/cors.middleware.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import { applyCorsHeaders } from "./utils/cors.util.js";

// Load environment variables
dotenv.config();

// Import all models to ensure they're registered
import "./model/user.model.js";

// Create Express application
const app = express();

// Initialize database connection - will be cached between serverless invocations
let dbInitialized = false;
const initializeDB = async () => {
	if (!dbInitialized) {
		try {
			await connectDB();
			dbInitialized = true;
		} catch (error) {
			console.error("❌ Database connection error:", error.message);
			// Don't exit process in serverless, just log the error
		}
	}
};

// Security middleware
app.use(
	helmet({
		// Disable the crossOriginResourcePolicy to allow loading resources from different origins
		crossOriginResourcePolicy: { policy: "cross-origin" },
	})
); // Add security headers

// Apply our custom CORS middleware to all routes before any other middleware
app.use(corsMiddleware);

// Apply the external cors package for standard routes
app.use(
	cors({
		origin: [
			"http://localhost:3000",
			"http://localhost:5500",
			"https://csmbd-assignment-frontend.vercel.app",
		], // Restrict to trusted origins
		credentials: true, // Allow cookies with CORS
		methods: ["GET", "POST", "PUT", "DELETE"], // Allow specific methods
		allowedHeaders: ["Content-Type", "Authorization"], // Allow specific headers
	})
);

// Request parsing middleware
app.use(express.json({ limit: "1mb" })); // Limit request body size
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Logging middleware - only in development
if (process.env.NODE_ENV === "development") {
	app.use(morgan("dev"));
}

// Database middleware - initialize connection for each request if not already connected
app.use(async (req, res, next) => {
	await initializeDB();
	next();
});

// Note: In serverless environments like Vercel, static file serving from local directories
// doesn't work well. For production, you should use a storage service like AWS S3.
// This route is kept for local development only.
if (process.env.NODE_ENV === "development") {
	app.use(
		"/uploads",
		(req, res, next) => {
			// Add CORS headers for image files
			applyCorsHeaders(req, res);
			res.setHeader("Cache-Control", "public, max-age=86400");
			next();
		},
		express.static(path.join(process.cwd(), "uploads"))
	);
}

// API Routes
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

// Root route
app.get("/", (req, res) => {
	res.send("Welcome to CSMBD Assignment Backend API");
});

// Health check endpoint - useful for debugging serverless issues
app.get("/api/health", async (req, res) => {
	let dbStatus = "unknown";

	try {
		// Test database connection - this is lightweight
		await sequelize.authenticate();
		dbStatus = "connected";
	} catch (err) {
		dbStatus = "disconnected";
		console.error("Health check - DB connection failed:", err.message);
	}

	// Return application status
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV,
		database: dbStatus,
		uptime: process.uptime(),
	});
});

// 404 handler for undefined routes
app.use((req, res) => {
	res.status(404).json({
		success: false,
		message: "Resource not found",
	});
});

// Global error handler
app.use(errorMiddleware);

// For local development only - don't include this in serverless
if (process.env.NODE_ENV === "development") {
	// Start server
	const server = app.listen(process.env.PORT || 5500, () => {
		console.log(
			`✅ Backend API is running on http://localhost:${process.env.PORT} in ${process.env.NODE_ENV} mode`
		);
	});

	// Handle unhandled promise rejections
	process.on("unhandledRejection", (err) => {
		console.error(
			"❌ UNHANDLED REJECTION! Shutting down...",
			err.name,
			err.message
		);
		console.error(err.stack);

		// Gracefully close server before exiting (only in development)
		server.close(() => {
			process.exit(1);
		});
	});
}

export default app;
