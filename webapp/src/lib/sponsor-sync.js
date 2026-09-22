import { createHash } from "node:crypto";
import { del, put } from "@vercel/blob";
import { Pool } from "pg";

export const SPONSOR_SOURCE_URL = "https://www.hc-cartouche.nl/sponsoren";
export const SPONSOR_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;

function decodeHtmlEntities(value) {
	return String(value ?? "")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}

function normalizeUrl(rawUrl) {
	const decoded = decodeHtmlEntities(rawUrl).trim();
	if (!decoded) return null;

	try {
		return new URL(decoded, SPONSOR_SOURCE_URL).toString();
	} catch {
		return null;
	}
}

function identityUrl(value) {
	if (!value) return null;

	try {
		const url = new URL(value);
		return `${url.hostname.toLowerCase()}${url.pathname.replace(/\/$/, "").toLowerCase()}`;
	} catch {
		return null;
	}
}

function sourceKeyFor(imageUrl) {
	try {
		const pathname = new URL(imageUrl).pathname;
		const sponsorId = pathname.match(/\/SponsorLogo\/([^/]+)\//i)?.[1];
		if (sponsorId) return `club-site:${sponsorId}`;
	} catch {
		// The validated image URL below still gets a deterministic fallback key.
	}

	return `club-site:${createHash("sha256").update(imageUrl).digest("hex").slice(0, 24)}`;
}

export function parseClubSponsors(html) {
	for (const [, encodedConfig] of String(html).matchAll(/data-widget-config="([^"]+)"/g)) {
		try {
			const config = JSON.parse(Buffer.from(encodedConfig, "base64").toString("utf8"));
			if (!Array.isArray(config?.lstSponsors)) continue;

			const seen = new Set();
			return config.lstSponsors
				.map((sponsor) => {
					const name = String(sponsor?.txt_Name ?? "").trim();
					const imageUrl = normalizeUrl(sponsor?.imgSponsor);
					return {
						name,
						imageUrl,
						websiteUrl: normalizeUrl(sponsor?.lnkSponsor),
						sourceKey: imageUrl ? sourceKeyFor(imageUrl) : null,
					};
				})
				.filter((sponsor) => {
					if (!sponsor.name || !sponsor.imageUrl || !sponsor.sourceKey || seen.has(sponsor.sourceKey)) {
						return false;
					}
					seen.add(sponsor.sourceKey);
					return true;
				});
		} catch {
			continue;
		}
	}

	return [];
}

function safeFilename(name, contentType) {
	const base = name
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "") || "sponsor";
	const extension = {
		"image/jpeg": "jpg",
		"image/png": "png",
		"image/webp": "webp",
		"image/svg+xml": "svg",
		"image/gif": "gif",
	}[contentType] ?? "img";
	return `${base}.${extension}`;
}

function detectImageType(bytes, declaredType) {
	if (declaredType?.startsWith("image/")) return declaredType;
	if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
	if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
	if (String.fromCharCode(...bytes.slice(0, 4)) === "GIF8") return "image/gif";
	if (
		String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
		String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
	) return "image/webp";

	const header = new TextDecoder().decode(bytes.slice(0, 512)).trimStart();
	if (header.startsWith("<svg") || (header.startsWith("<?xml") && header.includes("<svg"))) {
		return "image/svg+xml";
	}

	return null;
}

async function mirrorLogo(sponsor, fetchSource = fetch, upload = put) {
	const response = await fetchSource(sponsor.imageUrl, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; CartoucheKioskSponsorSync/1.0)" },
		signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok) throw new Error(`Logo van ${sponsor.name} gaf status ${response.status}`);

	const imageBytes = new Uint8Array(await response.arrayBuffer());
	if (imageBytes.byteLength > 8 * 1024 * 1024) {
		throw new Error(`Logo van ${sponsor.name} is groter dan 8 MB`);
	}
	const contentType = detectImageType(
		imageBytes,
		response.headers.get("content-type")?.split(";")[0]
	);
	if (!contentType) throw new Error(`Logo van ${sponsor.name} is geen herkenbare afbeelding`);

	return upload(
		`sponsors/imported/${safeFilename(sponsor.name, contentType)}`,
		imageBytes,
		{
			access: "public",
			addRandomSuffix: true,
			contentType,
			cacheControlMaxAge: 60 * 60 * 24 * 30,
		}
	);
}

function mapSettings(row) {
	return {
		enabled: row?.enabled === true,
		lastAttemptAt: row?.last_attempt_at ?? null,
		lastSuccessAt: row?.last_success_at ?? null,
		lastError: row?.last_error ?? null,
		lastStats: row?.last_stats ?? null,
	};
}

function createPool() {
	if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is niet geconfigureerd");
	return new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
}

export async function getSponsorSyncSettings() {
	const pool = createPool();
	try {
		const { rows } = await pool.query(
			`SELECT enabled, last_attempt_at, last_success_at, last_error, last_stats
			 FROM sponsor_sync_settings WHERE id = 'club-site'`
		);
		return mapSettings(rows[0]);
	} finally {
		await pool.end();
	}
}

export async function setSponsorSyncEnabled(enabled) {
	const pool = createPool();
	try {
		const { rows } = await pool.query(
			`INSERT INTO sponsor_sync_settings (id, enabled, updated_at)
			 VALUES ('club-site', $1, NOW())
			 ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()
			 RETURNING enabled, last_attempt_at, last_success_at, last_error, last_stats`,
			[enabled]
		);
		return mapSettings(rows[0]);
	} finally {
		await pool.end();
	}
}

export async function syncSponsorsFromClubSite({ force = false } = {}, dependencies = {}) {
	// Explicit dependencies let regression tests exercise the real sync flow
	// without touching the club site, production database, or Blob store.
	const pool = (dependencies.createPool ?? createPool)();
	const fetchSource = dependencies.fetch ?? fetch;
	const upload = dependencies.put ?? put;
	const removeBlob = dependencies.del ?? del;
	const client = await pool.connect();
	let locked = false;

	try {
		const lockResult = await client.query(
			"SELECT pg_try_advisory_lock(hashtext('cartouche-sponsor-sync')) AS locked"
		);
		locked = lockResult.rows[0]?.locked === true;
		if (!locked) return { skipped: true, reason: "already-running" };

		const settingsResult = await client.query(
			`SELECT enabled, last_attempt_at, last_success_at, last_error, last_stats
			 FROM sponsor_sync_settings WHERE id = 'club-site'`
		);
		const settings = mapSettings(settingsResult.rows[0]);
		if (!settings.enabled && !force) return { skipped: true, reason: "disabled", settings };

		if (!force && settings.lastSuccessAt) {
			const elapsed = Date.now() - new Date(settings.lastSuccessAt).getTime();
			if (elapsed < SPONSOR_SYNC_INTERVAL_MS - 5 * 60 * 1000) {
				return { skipped: true, reason: "not-due", settings };
			}
		}

		await client.query(
			`UPDATE sponsor_sync_settings
			 SET last_attempt_at = NOW(), last_error = NULL, updated_at = NOW()
			 WHERE id = 'club-site'`
		);

		let sourceSponsors;
		try {
			const sourceResponse = await fetchSource(SPONSOR_SOURCE_URL, {
				headers: { "User-Agent": "Mozilla/5.0 (compatible; CartoucheKioskSponsorSync/1.0)" },
				signal: AbortSignal.timeout(20_000),
			});
			if (!sourceResponse.ok) throw new Error(`Clubsite gaf status ${sourceResponse.status}`);

			sourceSponsors = parseClubSponsors(await sourceResponse.text());
			if (sourceSponsors.length === 0) {
				throw new Error("Geen sponsoren op de clubsite gevonden; synchronisatie afgebroken");
			}
		} catch (sourceError) {
			// The club site blocks Vercel's outbound IPs. The authenticated kiosk
			// relay supplies the same public page; never reconcile an old snapshot.
			const snapshot = await client.query(`SELECT html FROM sponsor_source_snapshot
				WHERE id = 'club-site' AND updated_at > NOW() - INTERVAL '24 hours'`);
			sourceSponsors = parseClubSponsors(snapshot.rows[0]?.html ?? "");
			if (!sourceSponsors.length) throw sourceError;
		}

		const existingResult = await client.query(
			`SELECT id, name, image_url, blob_pathname, website_url, sort_order, sync_source_key,
				sync_source_image_url, sync_present
			 FROM sponsors`
		);
		const existingRows = existingResult.rows;
		const bySourceKey = new Map(
			existingRows.filter((row) => row.sync_source_key).map((row) => [row.sync_source_key, row])
		);
		const byName = new Map(existingRows.map((row) => [row.name.trim().toLowerCase(), row]));
		const byWebsite = new Map(
			existingRows
				.map((row) => [identityUrl(row.website_url), row])
				.filter(([key]) => key)
		);
		const seenSourceKeys = [];
		const claimedExistingIds = new Set();
		const oldBlobPathnames = [];
		const stats = { found: sourceSponsors.length, created: 0, updated: 0, unchanged: 0, hidden: 0 };

		for (const [index, sponsor] of sourceSponsors.entries()) {
			seenSourceKeys.push(sponsor.sourceKey);
			let existing = bySourceKey.get(sponsor.sourceKey)
				?? byName.get(sponsor.name.toLowerCase())
				?? byWebsite.get(identityUrl(sponsor.websiteUrl));
			if (existing && claimedExistingIds.has(existing.id)) existing = null;
			if (existing) claimedExistingIds.add(existing.id);

			if (!existing) {
				const blob = await mirrorLogo(sponsor, fetchSource, upload);
				await client.query(
					`INSERT INTO sponsors (
						name, image_url, blob_pathname, website_url, sort_order, active,
						sync_source_key, sync_source_image_url, sync_present
					) VALUES ($1, $2, $3, $4, $5, true, $6, $7, true)`,
					[
						sponsor.name,
						blob.url,
						blob.pathname,
						sponsor.websiteUrl,
						(index + 1) * 10,
						sponsor.sourceKey,
						sponsor.imageUrl,
					]
				);
				stats.created += 1;
				continue;
			}

			const logoChanged = Boolean(
				existing.sync_source_image_url && existing.sync_source_image_url !== sponsor.imageUrl
			);
			let nextImageUrl = existing.image_url;
			let nextBlobPathname = existing.blob_pathname;

			if (logoChanged) {
				const blob = await mirrorLogo(sponsor, fetchSource, upload);
				nextImageUrl = blob.url;
				nextBlobPathname = blob.pathname;
				oldBlobPathnames.push(existing.blob_pathname);
			}

			const changed = logoChanged
				|| existing.name !== sponsor.name
				|| existing.website_url !== sponsor.websiteUrl
				|| existing.sort_order !== (index + 1) * 10
				|| existing.sync_source_key !== sponsor.sourceKey
				|| existing.sync_present !== true;

			await client.query(
				`UPDATE sponsors
				 SET name = $1, image_url = $2, blob_pathname = $3, website_url = $4,
					sort_order = $5, sync_source_key = $6, sync_source_image_url = $7,
					sync_present = true, updated_at = CASE WHEN $8 THEN NOW() ELSE updated_at END
				 WHERE id = $9`,
				[
					sponsor.name,
					nextImageUrl,
					nextBlobPathname,
					sponsor.websiteUrl,
					(index + 1) * 10,
					sponsor.sourceKey,
					sponsor.imageUrl,
					changed,
					existing.id,
				]
			);
			stats[changed ? "updated" : "unchanged"] += 1;
		}

		const hiddenResult = await client.query(
			`UPDATE sponsors
			 SET sync_present = false, updated_at = NOW()
			 WHERE sync_present = true
				AND (
					(sync_source_key IS NOT NULL AND NOT (sync_source_key = ANY($1::text[])))
					OR (sync_source_key IS NULL AND blob_pathname LIKE 'sponsors/imported/%')
				)
			 RETURNING id`,
			[seenSourceKeys]
		);
		stats.hidden = hiddenResult.rowCount;

		await client.query(
			`UPDATE sponsor_sync_settings
			 SET last_success_at = NOW(), last_error = NULL, last_stats = $1::jsonb, updated_at = NOW()
			 WHERE id = 'club-site'`,
			[JSON.stringify(stats)]
		);

		await Promise.all(
			oldBlobPathnames.map((pathname) =>
				removeBlob(pathname).catch((error) =>
					console.error("Oud gesynchroniseerd sponsorlogo verwijderen is mislukt", error)
				)
			)
		);

		return { skipped: false, stats };
	} catch (error) {
		await client.query(
			`UPDATE sponsor_sync_settings
			 SET last_error = $1, updated_at = NOW()
			 WHERE id = 'club-site'`,
			[String(error.message || "Onbekende synchronisatiefout").slice(0, 1000)]
		).catch(() => undefined);
		throw error;
	} finally {
		if (locked) {
			await client.query("SELECT pg_advisory_unlock(hashtext('cartouche-sponsor-sync'))").catch(() => undefined);
		}
		client.release();
		await pool.end();
	}
}
