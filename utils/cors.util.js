/**
 * Utility function to apply CORS headers consistently across the application
 * Especially useful for endpoints that serve static files/images
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
export const applyCorsHeaders = (req, res) => {
    const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5500",
        "https://csmbd-assignment-frontend.vercel.app",
    ];

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, DELETE, OPTIONS"
        );
        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, X-Requested-With"
        );
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Max-Age", "86400"); // 24 hours
        return res.status(204).end();
    }

    // For normal requests, set the appropriate origin
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        // For requests without origin header or not in allowed list
        // Default to the first allowed origin - this is more secure than a wildcard
        res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");
};
