import { QueryTypes } from "sequelize";
import { sequelize } from "./postgresql.js";

/**
 * Migration script to add new columns to the users table for profile management
 * Optimized for serverless environments with better error handling
 */
export const runMigrations = async () => {
    // Skip migrations in production/serverless environment
    if (process.env.NODE_ENV === "production") {
        console.log("Skipping migrations in production environment");
        return;
    }

    try {
        console.log("Running database migrations...");

        // Check if the users table exists first
        const tableCheck = await sequelize.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'users'
            )`,
            { type: QueryTypes.SELECT }
        );

        // If users table doesn't exist, skip migrations
        if (!tableCheck[0].exists) {
            console.log("Users table doesn't exist yet, skipping migrations");
            return;
        }

        // Check if the columns already exist to avoid errors
        const tableInfo = await sequelize.query(
            `SELECT column_name 
             FROM information_schema.columns 
             WHERE table_name = 'users'`,
            { type: QueryTypes.SELECT }
        );

        const existingColumns = tableInfo.map((col) => col.column_name);

        // Add refresh_token column if it doesn't exist
        if (!existingColumns.includes("refresh_token")) {
            await sequelize.query(
                `ALTER TABLE users ADD COLUMN refresh_token TEXT;`
            );
            console.log("Added 'refresh_token' column to users table");
        }

        // Add token_version column if it doesn't exist
        if (!existingColumns.includes("token_version")) {
            await sequelize.query(
                `ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;`
            );
            console.log("Added 'token_version' column to users table");
        }

        // Add bio column if it doesn't exist
        if (!existingColumns.includes("bio")) {
            await sequelize.query(`ALTER TABLE users ADD COLUMN bio TEXT;`);
            console.log("Added 'bio' column to users table");
        }

        // Add location column if it doesn't exist
        if (!existingColumns.includes("location")) {
            await sequelize.query(
                `ALTER TABLE users ADD COLUMN location VARCHAR(100);`
            );
            console.log("Added 'location' column to users table");
        }

        // Add youtube_links column if it doesn't exist
        if (!existingColumns.includes("youtube_links")) {
            await sequelize.query(
                `ALTER TABLE users ADD COLUMN youtube_links JSONB DEFAULT '[]';`
            );
            console.log("Added 'youtube_links' column to users table");
        }

        // Add profile_picture column if it doesn't exist
        if (!existingColumns.includes("profile_picture")) {
            await sequelize.query(
                `ALTER TABLE users ADD COLUMN profile_picture VARCHAR(255);`
            );
            console.log("Added 'profile_picture' column to users table");
        }

        console.log("Database migrations completed successfully");
    } catch (error) {
        // Log error but don't crash in production
        console.error("Error running database migrations:", error);
        if (process.env.NODE_ENV !== "production") {
            throw error;
        }
    }
};

export default runMigrations;
