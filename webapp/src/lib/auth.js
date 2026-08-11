import { betterAuth } from "better-auth";
import { Pool } from "pg";

const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 2,
	idleTimeoutMillis: 20_000,
	connectionTimeoutMillis: 10_000,
});

export const auth = betterAuth({
	appName: "Cartouche Kioskbeheer",
	database: pool,
	emailAndPassword: {
		enabled: true,
		disableSignUp: process.env.ALLOW_ADMIN_SIGNUP !== "true",
		minPasswordLength: 12,
		maxPasswordLength: 128,
	},
	session: {
		expiresIn: 60 * 60 * 12,
		updateAge: 60 * 60,
	},
	advanced: {
		useSecureCookies: process.env.NODE_ENV === "production",
	},
});
