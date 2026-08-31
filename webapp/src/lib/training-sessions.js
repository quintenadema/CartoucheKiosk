import { getSql } from "@/lib/db";

function mapDate(value) {
	if (!value) return null;
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Amsterdam",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(new Date(value));
}

function mapTrainingSession(row) {
	return {
		id: row.id,
		sourceKey: row.source_key,
		seasonLabel: row.season_label,
		dayOfWeek: row.day_of_week,
		fieldName: row.field_name,
		fieldArea: row.field_area,
		title: row.title,
		startTime: String(row.start_time).slice(0, 5),
		endTime: String(row.end_time).slice(0, 5),
		validFrom: mapDate(row.valid_from),
		validUntil: mapDate(row.valid_until),
		notes: row.notes,
		active: row.active,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function listTrainingSessions({ includeInactive = false, currentSeasonOnly = false } = {}) {
	const sql = getSql();
	let rows;

	if (includeInactive) {
		rows = await sql`
			SELECT * FROM training_sessions
			ORDER BY day_of_week ASC, start_time ASC, field_name ASC, field_area ASC, title ASC
		`;
	} else if (currentSeasonOnly) {
		rows = await sql`
			SELECT * FROM training_sessions
			WHERE active = true
				AND (now() AT TIME ZONE 'Europe/Amsterdam')::date BETWEEN valid_from AND valid_until
			ORDER BY day_of_week ASC, start_time ASC, field_name ASC, field_area ASC, title ASC
		`;
	} else {
		rows = await sql`
			SELECT * FROM training_sessions
			WHERE active = true
			ORDER BY day_of_week ASC, start_time ASC, field_name ASC, field_area ASC, title ASC
		`;
	}

	return rows.map(mapTrainingSession);
}

export async function createTrainingSession(input) {
	const sql = getSql();
	const [row] = await sql`
		INSERT INTO training_sessions (
			season_label, day_of_week, field_name, field_area, title,
			start_time, end_time, valid_from, valid_until, notes, active
		) VALUES (
			'2026-2027', ${input.dayOfWeek}, ${input.fieldName}, ${input.fieldArea}, ${input.title},
			${input.startTime}, ${input.endTime}, DATE '2026-07-06', DATE '2027-07-04', ${input.notes}, ${input.active}
		)
		RETURNING *
	`;

	return mapTrainingSession(row);
}

export async function updateTrainingSession(id, input) {
	const sql = getSql();
	const [row] = await sql`
		UPDATE training_sessions SET
			day_of_week = ${input.dayOfWeek},
			field_name = ${input.fieldName},
			field_area = ${input.fieldArea},
			title = ${input.title},
			start_time = ${input.startTime},
			end_time = ${input.endTime},
			notes = ${input.notes},
			active = ${input.active},
			updated_at = now()
		WHERE id = ${id}
		RETURNING *
	`;

	return row ? mapTrainingSession(row) : null;
}

export async function deleteTrainingSession(id) {
	const sql = getSql();
	const [row] = await sql`
		DELETE FROM training_sessions
		WHERE id = ${id}
		RETURNING id
	`;

	return row ?? null;
}
