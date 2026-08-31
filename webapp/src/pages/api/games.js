import { addDays, format } from "date-fns";
import { createHash, randomUUID } from "node:crypto";

const API_BASE_URL = "https://app.hockeyweerelt.nl";
const LOOKAHEAD_DAYS = 14;
const MATCH_DETAIL_CACHE_TTL_MS = 30 * 60 * 1000;
const MATCH_DETAIL_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const MATCH_DETAIL_CONCURRENCY = 2;
const FACILITY_MATCH_CACHE_TTL_MS = 2 * 60 * 1000;
const RESPONSE_CACHE_TTL_MS = 2 * 60 * 1000;
const RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const FACILITIES = [
	{ responseKey: "domeGames", id: 731, fallbackName: "Cartouche Hockey Dome" },
	{ responseKey: "duivesteynGames", id: 102, fallbackName: "V.M.H.C. Cartouche" },
];

const globalStore = globalThis.__cartoucheHockeyWeereltStore ??= {
	deviceSession: null,
	deviceSessionRequest: null,
	matchDetailCache: new Map(),
	matchDetailRequests: new Map(),
	facilityMatchesCache: new Map(),
	facilityMatchRequests: new Map(),
	latestGamesResponse: null,
	latestGamesRequest: null,
	rateLimitedUntil: 0,
};

class SignedRequestError extends Error {
	constructor(pathname, status, retryAfterMs = 0) {
		super(`Request to ${pathname} failed with ${status}`);
		this.name = "SignedRequestError";
		this.pathname = pathname;
		this.status = status;
		this.retryAfterMs = retryAfterMs;
	}
}

function getRetryAfterMs(response) {
	const retryAfterHeader = response.headers.get("retry-after");

	if (!retryAfterHeader) {
		return RATE_LIMIT_BACKOFF_MS;
	}

	const retryAfterSeconds = Number(retryAfterHeader);

	if (Number.isFinite(retryAfterSeconds)) {
		return Math.max(retryAfterSeconds * 1000, RATE_LIMIT_BACKOFF_MS);
	}

	const retryAfterDate = new Date(retryAfterHeader);

	if (Number.isNaN(retryAfterDate.getTime())) {
		return RATE_LIMIT_BACKOFF_MS;
	}

	return Math.max(retryAfterDate.getTime() - Date.now(), RATE_LIMIT_BACKOFF_MS);
}

function activateRateLimitBackoff(response, pathname) {
	const now = Date.now();
	const retryAfterMs = getRetryAfterMs(response);
	const wasAlreadyRateLimited = globalStore.rateLimitedUntil > now;

	globalStore.rateLimitedUntil = Math.max(
		globalStore.rateLimitedUntil,
		now + retryAfterMs
	);

	if (!wasAlreadyRateLimited) {
		console.warn(
			`HockeyWeerelt rate limit reached at ${pathname}; using cached or summary data for ${Math.ceil(retryAfterMs / 1000)}s`
		);
	}

	return retryAfterMs;
}

function sanitizePathname(pathname) {
	return pathname.replace(/[^a-zA-Z0-9\-/]+/g, "");
}

function sanitizeQuery(url) {
	return Array.from(new URLSearchParams(url.search).entries())
		.filter(([key]) => key.length > 0)
		.map(([key, value]) => {
			const sanitizedKey = key.replace(/[^a-zA-Z0-9\-/=]+/g, "");
			const sanitizedValue = String(value).replace(/[^a-zA-Z0-9\-/=]+/g, "");
			return `${sanitizedKey}=${sanitizedValue}`;
		})
		.join("");
}

function buildSignature(url, uuid, timestamp) {
	const payload = `${timestamp}${sanitizePathname(url.pathname)}${sanitizeQuery(url)}${uuid
		.split("")
		.reverse()
		.join("")}`;

	return createHash("sha1").update(payload).digest("hex");
}

async function registerDevice(uuid) {
	const response = await fetch(`${API_BASE_URL}/device/register`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
			"X-Requested-With": "XMLHttpRequest",
		},
		body: JSON.stringify({
			uuid,
			os: "Web",
		}),
	});

	if (!response.ok) {
		if (response.status === 429) {
			const retryAfterMs = activateRateLimitBackoff(
				response,
				"/device/register"
			);
			throw new SignedRequestError("/device/register", response.status, retryAfterMs);
		}

		throw new SignedRequestError("/device/register", response.status);
	}

	const body = await response.json();

	if (!body?.token) {
		throw new Error("Device registration did not return a token");
	}

	return {
		uuid,
		token: body.token,
	};
}

async function getDeviceSession(forceRefresh = false) {
	if (!forceRefresh && globalStore.deviceSession) {
		return globalStore.deviceSession;
	}

	if (globalStore.deviceSessionRequest) {
		return globalStore.deviceSessionRequest;
	}

	const previousSession = globalStore.deviceSession;
	const pendingRequest = (async () => {
		try {
			const session = await registerDevice(randomUUID());
			globalStore.deviceSession = session;
			return session;
		} catch (error) {
			if (
				previousSession &&
				error instanceof SignedRequestError &&
				error.status === 429
			) {
				return previousSession;
			}

			throw error;
		}
	})();

	globalStore.deviceSessionRequest = pendingRequest;

	try {
		return await pendingRequest;
	} finally {
		if (globalStore.deviceSessionRequest === pendingRequest) {
			globalStore.deviceSessionRequest = null;
		}
	}
}

function buildSignedHeaders(url, session) {
	const timestamp = Math.floor(Date.now() / 1000).toString();

	return {
		Accept: "application/json",
		"Content-Type": "application/json",
		"X-Requested-With": "XMLHttpRequest",
		"X-HAPI-Authorization": session.token,
		"X-HAPI-Timestamp": timestamp,
		"X-HAPI-Signature": buildSignature(url, session.uuid, timestamp),
		"X-HAPI-Version": "7",
	};
}

async function signedGet(url) {
	if (globalStore.rateLimitedUntil > Date.now()) {
		throw new SignedRequestError(
			url.pathname,
			429,
			globalStore.rateLimitedUntil - Date.now()
		);
	}

	for (const forceRefresh of [false, true]) {
		const session = await getDeviceSession(forceRefresh);
		const response = await fetch(url, {
			headers: buildSignedHeaders(url, session),
		});

		if (response.status === 401 && !forceRefresh) {
			continue;
		}

		if (response.status === 429) {
			const retryAfterMs = activateRateLimitBackoff(response, url.pathname);
			throw new SignedRequestError(url.pathname, response.status, retryAfterMs);
		}

		if (!response.ok) {
			throw new SignedRequestError(url.pathname, response.status);
		}

		const body = await response.json();
		return body;
	}

	throw new SignedRequestError(url.pathname, 401);
}

async function fetchFacilityMatches(facilityId) {
	const cachedFacilityMatches = globalStore.facilityMatchesCache.get(facilityId);

	if (cachedFacilityMatches && cachedFacilityMatches.expiresAt > Date.now()) {
		return cachedFacilityMatches.data;
	}

	if (globalStore.facilityMatchRequests.has(facilityId)) {
		return globalStore.facilityMatchRequests.get(facilityId);
	}

	if (globalStore.rateLimitedUntil > Date.now() && cachedFacilityMatches) {
		return cachedFacilityMatches.data;
	}

	const startDate = new Date();
	const endDate = addDays(startDate, LOOKAHEAD_DAYS);
	const url = new URL(`${API_BASE_URL}/facilities/${facilityId}/matches`);

	url.searchParams.set("filter[dateStart]", format(startDate, "yyyy-MM-dd"));
	url.searchParams.set("filter[dateEnd]", format(endDate, "yyyy-MM-dd"));

	const pendingRequest = (async () => {
		try {
			const body = await signedGet(url);
			const facilityData = body?.data ?? null;

			globalStore.facilityMatchesCache.set(facilityId, {
				data: facilityData,
				expiresAt: Date.now() + FACILITY_MATCH_CACHE_TTL_MS,
			});

			return facilityData;
		} catch (error) {
			if (
				cachedFacilityMatches &&
				error instanceof SignedRequestError &&
				error.status === 429
			) {
				return cachedFacilityMatches.data;
			}

			throw error;
		}
	})();

	globalStore.facilityMatchRequests.set(facilityId, pendingRequest);

	try {
		return await pendingRequest;
	} finally {
		globalStore.facilityMatchRequests.delete(facilityId);
	}
}

function getCachedMatchDetail(matchId) {
	const cachedEntry = globalStore.matchDetailCache.get(matchId);

	if (!cachedEntry) {
		return { hit: false, data: null };
	}

	const staleUntil = cachedEntry.staleUntil ?? cachedEntry.expiresAt;

	if (staleUntil <= Date.now()) {
		globalStore.matchDetailCache.delete(matchId);
		return { hit: false, stale: false, data: null };
	}

	return {
		hit: cachedEntry.expiresAt > Date.now(),
		stale: cachedEntry.expiresAt <= Date.now(),
		data: cachedEntry.data,
	};
}

async function fetchMatchDetail(matchId) {
	const cachedMatchDetail = getCachedMatchDetail(matchId);

	if (cachedMatchDetail.hit) {
		return cachedMatchDetail.data;
	}

	if (globalStore.matchDetailRequests.has(matchId)) {
		return globalStore.matchDetailRequests.get(matchId);
	}

	if (globalStore.rateLimitedUntil > Date.now()) {
		return cachedMatchDetail.stale ? cachedMatchDetail.data : null;
	}

	const pendingRequest = (async () => {
		const url = new URL(`${API_BASE_URL}/matches/${matchId}`);
		let matchDetail = null;

		try {
			const body = await signedGet(url);
			matchDetail = body?.data ?? body;
		} catch (error) {
			if (error instanceof SignedRequestError && error.status === 429) {
				return cachedMatchDetail.stale ? cachedMatchDetail.data : null;
			}

			if (!(error instanceof SignedRequestError) || error.status !== 404) {
				throw error;
			}
		}

		globalStore.matchDetailCache.set(matchId, {
			data: matchDetail,
			expiresAt: Date.now() + MATCH_DETAIL_CACHE_TTL_MS,
			staleUntil: Date.now() + MATCH_DETAIL_STALE_TTL_MS,
		});

		return matchDetail;
	})();

	globalStore.matchDetailRequests.set(matchId, pendingRequest);

	try {
		return await pendingRequest;
	} finally {
		globalStore.matchDetailRequests.delete(matchId);
	}
}

async function mapWithConcurrency(items, mapper, concurrency) {
	const results = new Array(items.length);
	let currentIndex = 0;

	async function worker() {
		while (currentIndex < items.length) {
			const index = currentIndex;
			currentIndex += 1;
			results[index] = await mapper(items[index], index);
		}
	}

	const workerCount = Math.min(concurrency, items.length);
	await Promise.all(Array.from({ length: workerCount }, () => worker()));

	return results;
}

function normalizeMatch(summaryMatch, detailMatch, facility) {
	const match = detailMatch ?? summaryMatch;
	const hasScore =
		typeof match?.score?.home === "number" && typeof match?.score?.away === "number";

	return {
		id: summaryMatch.id,
		datetime: match.date ?? summaryMatch.date,
		field:
			match.location?.field?.name ??
			match.field_name ??
			match.field?.name ??
			null,
		competition:
			match.competition_name ??
			match.poule_name ??
			match.home?.category_group_name ??
			facility.name,
		poule: match.poule_name,
		status: match.status,
		round: match.round,
		home_score: hasScore ? match.score.home : null,
		away_score: hasScore ? match.score.away : null,
		home_team: {
			name: match.home?.name ?? "Unknown",
			logo: match.home?.logo ?? null,
			club_name: match.home?.name ?? "Unknown",
			short_name: match.home?.short_name ?? null,
		},
		away_team: {
			name: match.away?.name ?? "Unknown",
			logo: match.away?.logo ?? null,
			club_name: match.away?.name ?? "Unknown",
			short_name: match.away?.short_name ?? null,
		},
		facility: {
			id: facility.id,
			name: match.location?.facility?.name ?? facility.name,
		},
	};
}

async function fetchGamesPayload() {
	const facilities = await Promise.all(
		FACILITIES.map(async (configuration) => ({
			...configuration,
			facility: await fetchFacilityMatches(configuration.id),
		}))
	);
	const matchJobs = facilities.flatMap(
		({ responseKey, id, fallbackName, facility }) =>
			(facility?.matches ?? []).map((summaryMatch) => ({
				responseKey,
				id,
				fallbackName,
				facility,
				summaryMatch,
			}))
	);
	const normalizedMatches = await mapWithConcurrency(
		matchJobs,
		async ({ responseKey, id, fallbackName, facility, summaryMatch }) => {
			let detailMatch = null;

			try {
				detailMatch = await fetchMatchDetail(summaryMatch.id);
			} catch (error) {
				console.warn(
					`Falling back to summary match for ${summaryMatch.id}`,
					error
				);
			}

			return {
				responseKey,
				match: normalizeMatch(summaryMatch, detailMatch, {
					id,
					name: facility?.name ?? fallbackName,
				}),
			};
		},
		MATCH_DETAIL_CONCURRENCY
	);
	const payload = Object.fromEntries(
		FACILITIES.map(({ responseKey }) => [responseKey, []])
	);

	for (const { responseKey, match } of normalizedMatches) {
		payload[responseKey].push(match);
	}

	globalStore.latestGamesResponse = {
		payload,
		expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
	};

	return payload;
}

function sendGamesResponse(res, payload) {
	res.setHeader(
		"Cache-Control",
		"public, s-maxage=120, stale-while-revalidate=600"
	);
	res.status(200).json(payload);
}

export default async function handler(req, res) {
	if (
		globalStore.latestGamesResponse &&
		(globalStore.latestGamesResponse.expiresAt > Date.now() ||
			globalStore.rateLimitedUntil > Date.now())
	) {
		sendGamesResponse(res, globalStore.latestGamesResponse.payload);
		return;
	}

	const pendingRequest = globalStore.latestGamesRequest ?? fetchGamesPayload();
	globalStore.latestGamesRequest = pendingRequest;

	try {
		const payload = await pendingRequest;
		sendGamesResponse(res, payload);
	} catch (error) {
		console.error("Failed to fetch games", error);

		if (globalStore.latestGamesResponse) {
			sendGamesResponse(res, globalStore.latestGamesResponse.payload);
			return;
		}

		res.status(500).json({ error: "Failed to fetch games" });
	} finally {
		if (globalStore.latestGamesRequest === pendingRequest) {
			globalStore.latestGamesRequest = null;
		}
	}
}
