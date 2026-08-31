const CLUB_BASE_URL = "https://www.hc-cartouche.nl";
const CLUB_HOME_URL = `${CLUB_BASE_URL}/`;
const CLUB_NEWS_URL = `${CLUB_BASE_URL}/rts/collections/public/bc321c9b/runtime/collection/Nieuws/query-data?pageSize=12&pageNumber=0&query=%28%29&language=DUTCH`;
const CACHE_TTL_MS = 15 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 12_000;
const RESPONSE_CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=3600";
const STORE_VERSION = 3;

const clubContentStore = globalThis.__cartoucheClubContentStore?.version === STORE_VERSION
	? globalThis.__cartoucheClubContentStore
	: {
		version: STORE_VERSION,
		data: null,
		expiresAt: 0,
		pending: null,
	};

globalThis.__cartoucheClubContentStore = clubContentStore;

function absoluteClubUrl(value, fallbackPath = "/") {
	if (!value) return `${CLUB_BASE_URL}${fallbackPath}`;

	try {
		return new URL(value, CLUB_BASE_URL).toString();
	} catch {
		return `${CLUB_BASE_URL}${fallbackPath}`;
	}
}

function dateKey(value, time = "00:00") {
	const [day, month, year] = String(value ?? "").split("-");
	if (!day || !month || !year) return "";
	return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${String(time || "00:00").slice(0, 5)}`;
}

function todayKeyInAmsterdam() {
	const parts = new Intl.DateTimeFormat("en-GB", {
		timeZone: "Europe/Amsterdam",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date());
	const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
	return `${values.year}-${values.month}-${values.day}`;
}

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
			"User-Agent": "Mozilla/5.0 (compatible; CartoucheKiosk/1.0; +https://www.hc-cartouche.nl/)",
		},
		signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
	});

	if (!response.ok) {
		throw new Error(`Cartouche content request failed with ${response.status}`);
	}

	return response.text();
}

function normalizeNews(payload) {
	const rows = Array.isArray(payload?.values) ? payload.values : [];

	return rows
		.map((row) => {
			const data = row?.data ?? row;
			const id = data?.id ?? row?.page_item_url;
			if (!id || !data?.title) return null;

			return {
				id: String(id),
				title: String(data.title).trim(),
				date: data.starts_at_date || data.inserted_at_date || null,
				time: data.starts_at_time || data.inserted_at_time || null,
				image: data.homepage_image || data.assets?.find((asset) => asset?.is_primary)?.url || null,
				url: absoluteClubUrl(`/news-detail/${row.page_item_url || id}`),
				pinned: data.is_pinned === true || data.is_pinned === "true",
			};
		})
		.filter(Boolean)
		.sort((first, second) => {
			if (first.pinned !== second.pinned) return first.pinned ? -1 : 1;
			return dateKey(second.date, second.time).localeCompare(dateKey(first.date, first.time));
		})
		.slice(0, 5);
}

function findAgendaConfig(html) {
	const configPattern = /data-widget-config="([A-Za-z0-9+/=]+)"/g;
	let match;

	while ((match = configPattern.exec(html)) !== null) {
		try {
			const config = JSON.parse(Buffer.from(match[1], "base64").toString("utf8"));
			if (Array.isArray(config?.lstAgenda)) return config.lstAgenda;
		} catch {
			// Other widgets can contain non-JSON or unrelated base64 configuration.
		}
	}

	return [];
}

function normalizeAgenda(html) {
	const today = todayKeyInAmsterdam();
	let agendaMarkup = html;

	try {
		const pagePayload = JSON.parse(html);
		if (typeof pagePayload?.content === "string") {
			agendaMarkup = pagePayload.content;
		}
	} catch {
		// The normal browser response is already HTML.
	}

	return findAgendaConfig(agendaMarkup)
		.map((item, index) => ({
			id: String(item?.lnkTitle || `${item?.txt_Date}-${item?.txt_Time}-${index}`),
			title: String(item?.txt_Title ?? "").trim(),
			date: item?.txt_Date || null,
			endDate: item?.txt_endDate || null,
			time: item?.txt_Time || null,
			url: absoluteClubUrl(item?.lnkTitle, "/clubagenda"),
		}))
		.filter((item) => item.title && dateKey(item.date).slice(0, 10) >= today)
		.sort((first, second) => dateKey(first.date, first.time).localeCompare(dateKey(second.date, second.time)))
		.slice(0, 6);
}

async function loadClubContent() {
	const [newsResult, agendaResult] = await Promise.allSettled([
		fetchText(CLUB_NEWS_URL),
		fetchText(CLUB_HOME_URL),
	]);

	if (newsResult.status === "rejected" && agendaResult.status === "rejected") {
		throw newsResult.reason;
	}

	let news = clubContentStore.data?.news ?? [];
	let agenda = clubContentStore.data?.agenda ?? [];

	if (newsResult.status === "fulfilled") {
		try {
			const nextNews = normalizeNews(JSON.parse(newsResult.value));
			if (nextNews.length > 0) news = nextNews;
		} catch {
			// Preserve stale news when the upstream payload is temporarily malformed.
		}
	}

	if (agendaResult.status === "fulfilled") {
		const nextAgenda = normalizeAgenda(agendaResult.value);
		if (nextAgenda.length > 0) agenda = nextAgenda;
	}

	return {
		news,
		agenda,
		fetchedAt: new Date().toISOString(),
	};
}

async function getClubContent() {
	if (clubContentStore.data && clubContentStore.expiresAt > Date.now()) {
		return clubContentStore.data;
	}

	if (!clubContentStore.pending) {
		clubContentStore.pending = loadClubContent()
			.then((data) => {
				clubContentStore.data = data;
				clubContentStore.expiresAt = Date.now() + CACHE_TTL_MS;
				return data;
			})
			.finally(() => {
				clubContentStore.pending = null;
			});
	}

	return clubContentStore.pending;
}

export default async function handler(request, response) {
	if (request.method !== "GET") {
		response.setHeader("Allow", "GET");
		return response.status(405).json({ error: "Method not allowed" });
	}

	response.setHeader("Cache-Control", RESPONSE_CACHE_CONTROL);

	try {
		return response.status(200).json(await getClubContent());
	} catch {
		return response.status(200).json(
			clubContentStore.data ?? { news: [], agenda: [], fetchedAt: null }
		);
	}
}
