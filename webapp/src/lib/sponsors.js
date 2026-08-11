import { getSql } from "@/lib/db";

function mapSponsor(row) {
	return {
		id: row.id,
		name: row.name,
		image: row.image_url,
		imageUrl: row.image_url,
		blobPathname: row.blob_pathname,
		url: row.website_url,
		websiteUrl: row.website_url,
		sortOrder: row.sort_order,
		active: row.active,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export async function listSponsors({ includeInactive = false } = {}) {
	const sql = getSql();
	const rows = includeInactive
		? await sql`
			SELECT id, name, image_url, blob_pathname, website_url, sort_order, active, created_at, updated_at
			FROM sponsors
			ORDER BY sort_order ASC, name ASC
		`
		: await sql`
			SELECT id, name, image_url, blob_pathname, website_url, sort_order, active, created_at, updated_at
			FROM sponsors
			WHERE active = true
			ORDER BY sort_order ASC, name ASC
		`;

	return rows.map(mapSponsor);
}

export async function createSponsor(input) {
	const sql = getSql();
	const [row] = await sql`
		INSERT INTO sponsors (name, image_url, blob_pathname, website_url, sort_order, active)
		VALUES (${input.name}, ${input.imageUrl}, ${input.blobPathname}, ${input.websiteUrl}, ${input.sortOrder}, ${input.active})
		RETURNING id, name, image_url, blob_pathname, website_url, sort_order, active, created_at, updated_at
	`;

	return mapSponsor(row);
}

export async function updateSponsor(id, input) {
	const sql = getSql();
	const [row] = await sql`
		UPDATE sponsors
		SET name = ${input.name},
			image_url = ${input.imageUrl},
			blob_pathname = ${input.blobPathname},
			website_url = ${input.websiteUrl},
			sort_order = ${input.sortOrder},
			active = ${input.active},
			updated_at = NOW()
		WHERE id = ${id}
		RETURNING id, name, image_url, blob_pathname, website_url, sort_order, active, created_at, updated_at
	`;

	return row ? mapSponsor(row) : null;
}

export async function deleteSponsor(id) {
	const sql = getSql();
	const [row] = await sql`
		DELETE FROM sponsors
		WHERE id = ${id}
		RETURNING id, blob_pathname
	`;

	return row ?? null;
}
