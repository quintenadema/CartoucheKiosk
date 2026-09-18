const MAX_TITLE_LENGTH = 120;
const MAX_URL_LENGTH = 2_048;

function requiredUrl(value) {
	const normalized = String(value ?? "").trim();
	if (!normalized) throw new Error("Een afbeelding is verplicht");
	if (normalized.length > MAX_URL_LENGTH) throw new Error("De afbeeldings-URL is te lang");

	let url;
	try {
		url = new URL(normalized);
	} catch {
		throw new Error("De afbeeldings-URL is ongeldig");
	}

	if (!["http:", "https:"].includes(url.protocol)) {
		throw new Error("De afbeeldings-URL moet met http of https beginnen");
	}

	return url.toString();
}

export function validateSpotlightInput(body) {
	const title = String(body?.title ?? "").trim();
	if (!title) throw new Error("Naam is verplicht");
	if (title.length > MAX_TITLE_LENGTH) throw new Error("Naam is te lang");

	const blobPathname = String(body?.blobPathname ?? "").trim();
	if (!/^spotlights\/[^/]+$/.test(blobPathname)) {
		throw new Error("Ongeldig Blob-pad voor de afbeelding");
	}

	const sortOrder = Number(body?.sortOrder ?? 0);
	if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 100_000) {
		throw new Error("Volgorde moet een positief geheel getal zijn");
	}

	return {
		title,
		imageUrl: requiredUrl(body?.imageUrl),
		blobPathname,
		sortOrder,
		active: body?.active !== false,
	};
}
