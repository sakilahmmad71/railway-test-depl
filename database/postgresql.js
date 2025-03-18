import dotenv from "dotenv";
import { Sequelize } from "sequelize";

dotenv.config();

/**
 * PostgreSQL Database Configuration
 * Optimized for serverless environments
 */

// Validate database connection string early to fail fast
// if (!process.env.DB_URI) {
// 	throw new Error(
// 		`DB_URI is not defined in the ${process.env.NODE_ENV} environment variables`
// 	);
// }

// Significantly reduced pool config for serverless environment
const poolConfig = {
	max: 1, // Single connection for serverless functions
	min: 0, // No minimum connections
	acquire: 30050, // 30 second timeout
	idle: 10000, // 10 seconds before connection is released
};

// Create Sequelize instance with serverless-optimized configuration
// const sequelize = new Sequelize(process.env.DB_URI, {
const sequelize = new Sequelize("postgresql://csmbd_assignment_db_user:7yzvOnkQak3fMQePACkTVNNvYW09ipaf@dpg-cva5pd8fnakc73fv73ig-a.oregon-postgres.render.com/csmbd_assignment_db", {
	dialect: "postgres",
	logging: false, // Disable logging in production

	// SSL Configuration
	ssl: true,
	dialectOptions: {
		ssl: {
			rejectUnauthorized: false, // Required for some hosted PostgreSQL services
		},
		connectTimeout: 30050, // 30 second connection timeout
	},

	// Model definition defaults
	define: {
		underscored: true, // Use snake_case for table fields
		timestamps: true, // Add created_at and updated_at columns
		freezeTableName: true, // Prevent pluralization of table names
	},

	// Connection pool configuration
	pool: poolConfig,
});

/**
 * Database connection function optimized for serverless environments
 */
const connectDB = async () => {
	try {
		await sequelize.authenticate();
		console.log("✅ Connected to PostgreSQL");
		return true;
	} catch (error) {
		console.error("❌ Database connection error:", error.message);

		// Log detailed error if available
		if (error.original) {
			console.error("Details:", {
				code: error.original.code,
				errno: error.original.errno,
				syscall: error.original.syscall,
			});
		}

		// Throw error but don't exit process in serverless
		throw error;
	}
};

// Export sequelize instance and connection function
export { sequelize };
export default connectDB;
