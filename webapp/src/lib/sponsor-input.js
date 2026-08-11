const MAX_NAME_LENGTH = 120;
const MAX_URL_LENGTH = 2_048;

function optionalUrl(value, fieldName) {
	const normalized = String(value ?? "").trim();
	if (!normalized) return null;
	if (normalized.length > MAX_URL_LENGTH) throw new Error(`${fieldName} is te lang`);

	let url;
	try {
		url = new URL(normalized);
	} catch {
		throw new Error(`${fieldName} is geen geldige URL`);
	}

	if (!['http:', 'https:'].includes(url.protocol)) {
		throw new Error(`${fieldName} moet met http of https beginnen`);
	}

	return url.toString();
}

export function validateSponsorInput(body) {
	const name = String(body?.name ?? "").trim();
	if (!name) throw new Error("Naam is verplicht");
	if (name.length > MAX_NAME_LENGTH) throw new Error("Naam is te lang");

	const imageUrl = optionalUrl(body?.imageUrl, "Afbeeldings-URL");
	if (!imageUrl) throw new Error("Een sponsorlogo is verplicht");

	const blobPathname = String(body?.blobPathname ?? "").trim();
	if (!blobPathname.startsWith("sponsors/")) {
		throw new Error("Ongeldig Blob-pad");
	}

	const numericSortOrder = Number(body?.sortOrder ?? 0);
	if (!Number.isInteger(numericSortOrder) || numericSortOrder < 0 || numericSortOrder > 100_000) {
		throw new Error("Volgorde moet een positief geheel getal zijn");
	}

	return {
		name,
		imageUrl,
		blobPathname,
		websiteUrl: optionalUrl(body?.websiteUrl, "Website-URL"),
		sortOrder: numericSortOrder,
		active: body?.active !== false,
	};
}
