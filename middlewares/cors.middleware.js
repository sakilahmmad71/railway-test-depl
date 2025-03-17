/**
 * Custom CORS middleware for handling cross-origin requests
 * This is more flexible than the cors npm package for specific routes
 */
const corsMiddleware = (req, res, next) => {
    const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:5500",
        "https://csmbd-assignment-frontend.vercel.app",
    ];

    const origin = req.headers.origin;

    // Handle preflight requests
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", origin || "*");
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

    // Set CORS headers for normal requests
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        // For requests without origin or origins not in allowed list
        res.setHeader("Access-Control-Allow-Origin", allowedOrigins[0]);
    }

    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With"
    );
    res.setHeader("Access-Control-Allow-Credentials", "true");

    next();
};

export default corsMiddleware;
