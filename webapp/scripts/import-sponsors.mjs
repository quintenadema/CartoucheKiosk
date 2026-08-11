import { put } from "@vercel/blob";
import { Pool } from "pg";

const SOURCE_URL = "https://www.hc-cartouche.nl/sponsoren";

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
		return new URL(decoded, SOURCE_URL).toString();
	} catch {
		return null;
	}
}

function parseSponsors(html) {
	for (const [, encodedConfig] of html.matchAll(/data-widget-config="([^"]+)"/g)) {
		try {
			const config = JSON.parse(Buffer.from(encodedConfig, "base64").toString("utf8"));
			if (!Array.isArray(config?.lstSponsors)) continue;

			const seen = new Set();
			return config.lstSponsors
				.map((sponsor) => ({
					name: String(sponsor?.txt_Name ?? "").trim(),
					imageUrl: normalizeUrl(sponsor?.imgSponsor),
					websiteUrl: normalizeUrl(sponsor?.lnkSponsor),
				}))
				.filter((sponsor) => {
					const key = `${sponsor.name.toLowerCase()}::${sponsor.imageUrl}`;
					if (!sponsor.name || !sponsor.imageUrl || seen.has(key)) return false;
					seen.add(key);
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
	if (header.startsWith("<svg") || header.startsWith("<?xml") && header.includes("<svg")) {
		return "image/svg+xml";
	}

	return null;
}

if (!process.env.DATABASE_URL || !process.env.BLOB_READ_WRITE_TOKEN) {
	throw new Error("DATABASE_URL en BLOB_READ_WRITE_TOKEN zijn verplicht.");
}

const sourceResponse = await fetch(SOURCE_URL, {
	headers: { "User-Agent": "Mozilla/5.0 (compatible; CartoucheDomeImporter/1.0)" },
});
if (!sourceResponse.ok) throw new Error(`Clubsite gaf status ${sourceResponse.status}`);

const sponsors = parseSponsors(await sourceResponse.text());
if (!sponsors.length) throw new Error("Geen sponsoren in de clubsite gevonden; import afgebroken.");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const existingRows = await pool.query("SELECT lower(name) AS name FROM sponsors");
const existingNames = new Set(existingRows.rows.map((row) => row.name));
let imported = 0;

try {
	for (const [index, sponsor] of sponsors.entries()) {
		if (existingNames.has(sponsor.name.toLowerCase())) {
			console.log(`Overgeslagen (bestaat al): ${sponsor.name}`);
			continue;
		}

		const imageResponse = await fetch(sponsor.imageUrl);
		if (!imageResponse.ok) {
			console.warn(`Logo overgeslagen (${imageResponse.status}): ${sponsor.name}`);
			continue;
		}

		const imageBytes = new Uint8Array(await imageResponse.arrayBuffer());
		const contentType = detectImageType(
			imageBytes,
			imageResponse.headers.get("content-type")?.split(";")[0]
		);
		if (!contentType) {
			console.warn(`Geen afbeelding ontvangen: ${sponsor.name}`);
			continue;
		}

		const blob = await put(
			`sponsors/imported/${safeFilename(sponsor.name, contentType)}`,
			imageBytes,
			{
				access: "public",
				addRandomSuffix: true,
				contentType,
				cacheControlMaxAge: 60 * 60 * 24 * 30,
			}
		);

		await pool.query(
			`INSERT INTO sponsors (name, image_url, blob_pathname, website_url, sort_order, active)
			 VALUES ($1, $2, $3, $4, $5, true)`,
			[sponsor.name, blob.url, blob.pathname, sponsor.websiteUrl, (index + 1) * 10]
		);
		existingNames.add(sponsor.name.toLowerCase());
		imported += 1;
		console.log(`Geïmporteerd: ${sponsor.name}`);
	}
} finally {
	await pool.end();
}

console.log(`${imported} van ${sponsors.length} sponsoren nieuw geïmporteerd.`);
