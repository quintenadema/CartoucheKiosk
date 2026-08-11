import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Pool } from "pg";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL ontbreekt. Voer eerst `vercel env pull .env.local` uit.");
}

const migrationsDirectory = resolve(process.cwd(), "migrations");
const migrationFiles = (await readdir(migrationsDirectory))
	.filter((name) => name.endsWith(".sql"))
	.sort();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
	await client.query("BEGIN");
	for (const migrationFile of migrationFiles) {
		const sql = await readFile(resolve(migrationsDirectory, migrationFile), "utf8");
		await client.query(sql);
		console.log(`Toegepast: ${migrationFile}`);
	}
	await client.query("COMMIT");
} catch (error) {
	await client.query("ROLLBACK");
	throw error;
} finally {
	client.release();
	await pool.end();
}
