import { getSql } from "@/lib/db";

function mapSpotlight(row) {
	return {
		id: row.id,
		title: row.title,
		imageUrl: row.image_url,
		blobPathname: row.blob_pathname,
		sortOrder: row.sort_order,
		active: row.active,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function listSpotlights({ includeInactive = false } = {}) {
	const sql = getSql();
	const rows = includeInactive
		? await sql`
			SELECT id, title, image_url, blob_pathname, sort_order, active, created_at, updated_at
			FROM spotlights
			ORDER BY sort_order ASC, title ASC
		`
		: await sql`
			SELECT id, title, image_url, blob_pathname, sort_order, active, created_at, updated_at
			FROM spotlights
			WHERE active = true
			ORDER BY sort_order ASC, title ASC
		`;

	return rows.map(mapSpotlight);
}

export async function createSpotlight(input) {
	const sql = getSql();
	const [row] = await sql`
		INSERT INTO spotlights (title, image_url, blob_pathname, sort_order, active)
		VALUES (${input.title}, ${input.imageUrl}, ${input.blobPathname}, ${input.sortOrder}, ${input.active})
		RETURNING id, title, image_url, blob_pathname, sort_order, active, created_at, updated_at
	`;

	return mapSpotlight(row);
}

export async function updateSpotlight(id, input) {
	const sql = getSql();
	const [row] = await sql`
		UPDATE spotlights
		SET title = ${input.title},
			image_url = ${input.imageUrl},
			blob_pathname = ${input.blobPathname},
			sort_order = ${input.sortOrder},
			active = ${input.active},
			updated_at = NOW()
		WHERE id = ${id}
		RETURNING id, title, image_url, blob_pathname, sort_order, active, created_at, updated_at
	`;

	return row ? mapSpotlight(row) : null;
}

export async function deleteSpotlight(id) {
	const sql = getSql();
	const [row] = await sql`
		DELETE FROM spotlights
		WHERE id = ${id}
		RETURNING id, blob_pathname
	`;

	return row ?? null;
}
