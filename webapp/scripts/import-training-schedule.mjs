import { Pool } from "pg";
import { initialTrainingSchedule } from "../src/data/training-schedule-2026-2027.js";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL ontbreekt. Voer eerst `vercel env pull .env.local` uit.");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
	await client.query("BEGIN");

	for (const session of initialTrainingSchedule) {
		await client.query(
			`INSERT INTO training_sessions (
				source_key, season_label, day_of_week, field_name, field_area, title,
				start_time, end_time, valid_from, valid_until, notes, active
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
			ON CONFLICT (source_key) DO UPDATE SET
				season_label = EXCLUDED.season_label,
				day_of_week = EXCLUDED.day_of_week,
				field_name = EXCLUDED.field_name,
				field_area = EXCLUDED.field_area,
				title = EXCLUDED.title,
				start_time = EXCLUDED.start_time,
				end_time = EXCLUDED.end_time,
				valid_from = EXCLUDED.valid_from,
				valid_until = EXCLUDED.valid_until,
				notes = EXCLUDED.notes,
				updated_at = now()`,
			[
				session.sourceKey,
				session.seasonLabel,
				session.dayOfWeek,
				session.fieldName,
				session.fieldArea,
				session.title,
				session.startTime,
				session.endTime,
				session.validFrom,
				session.validUntil,
				session.notes,
				session.active,
			]
		);
	}

	await client.query("COMMIT");
	console.log(`${initialTrainingSchedule.length} trainingen geïmporteerd.`);
} catch (error) {
	await client.query("ROLLBACK");
	throw error;
} finally {
	client.release();
	await pool.end();
}
