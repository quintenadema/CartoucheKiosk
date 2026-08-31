import { addDays, format } from "date-fns";
import { createHash, randomUUID } from "node:crypto";

const API_BASE_URL = "https://app.hockeyweerelt.nl";
const CARTOUCHE_FACILITY_ID = 102;
const TRACKED_HOME_TEAMS = new Map([
	[268, "Dames 1"],
	[2722, "Heren 1"],
]);
const PRE_MATCH_WINDOW_MS = 15 * 60 * 1000;
const MAX_MATCH_WINDOW_MS = 3 * 60 * 60 * 1000;
const SCHEDULE_CACHE_TTL_MS = 60 * 1000;
const LIVE_DETAIL_CACHE_TTL_MS = 12 * 1000;
const LIVE_RESPONSE_CACHE_TTL_MS = 10 * 1000;
const RATE_LIMIT_BACKOFF_MS = 60 * 1000;
const STOPPED_STATUSES = new Set([
	"cancelled",
	"discontinued",
	"expired",
	"final",
	"result",
]);

const globalStore = globalThis.__cartoucheHockeyWeereltStore ??= {};
globalStore.deviceSession ??= null;
globalStore.deviceSessionRequest ??= null;
globalStore.matchDetailCache ??= new Map();
globalStore.matchDetailRequests ??= new Map();
globalStore.facilityMatchesCache ??= new Map();
globalStore.facilityMatchRequests ??= new Map();
globalStore.latestGamesResponse ??= null;
globalStore.latestGamesRequest ??= null;
globalStore.rateLimitedUntil ??= 0;
globalStore.liveScheduleCache ??= null;
globalStore.liveScheduleRequest ??= null;
globalStore.liveDetailCache ??= new Map();
globalStore.liveDetailRequests ??= new Map();
globalStore.completedLiveMatches ??= new Set();
globalStore.latestLiveResponse ??= null;
globalStore.latestLiveRequest ??= null;

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

	if (!retryAfterHeader) return RATE_LIMIT_BACKOFF_MS;

	const retryAfterSeconds = Number(retryAfterHeader);
	if (Number.isFinite(retryAfterSeconds)) {
		return Math.max(retryAfterSeconds * 1000, RATE_LIMIT_BACKOFF_MS);
	}

	const retryAfterDate = new Date(retryAfterHeader);
	if (Number.isNaN(retryAfterDate.getTime())) return RATE_LIMIT_BACKOFF_MS;

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
			`HockeyWeerelt live polling rate limited at ${pathname}; backing off for ${Math.ceil(retryAfterMs / 1000)}s`
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
		body: JSON.stringify({ uuid, os: "Web" }),
	});

	if (!response.ok) {
		if (response.status === 429) {
			const retryAfterMs = activateRateLimitBackoff(response, "/device/register");
			throw new SignedRequestError("/device/register", response.status, retryAfterMs);
		}

		throw new SignedRequestError("/device/register", response.status);
	}

	const body = await response.json();
	if (!body?.token) throw new Error("Device registration did not return a token");

	return { uuid, token: body.token };
}

async function getDeviceSession(forceRefresh = false) {
	if (!forceRefresh && globalStore.deviceSession) return globalStore.deviceSession;
	if (globalStore.deviceSessionRequest) return globalStore.deviceSessionRequest;

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

		if (response.status === 401 && !forceRefresh) continue;

		if (response.status === 429) {
			const retryAfterMs = activateRateLimitBackoff(response, url.pathname);
			throw new SignedRequestError(url.pathname, response.status, retryAfterMs);
		}

		if (!response.ok) {
			throw new SignedRequestError(url.pathname, response.status);
		}

		return response.json();
	}

	throw new SignedRequestError(url.pathname, 401);
}

async function fetchLiveSchedule() {
	if (
		globalStore.liveScheduleCache &&
		globalStore.liveScheduleCache.expiresAt > Date.now()
	) {
		return globalStore.liveScheduleCache.data;
	}

	if (globalStore.liveScheduleRequest) return globalStore.liveScheduleRequest;

	const previousSchedule = globalStore.liveScheduleCache?.data ?? null;
	const pendingRequest = (async () => {
		const startDate = new Date();
		const endDate = addDays(startDate, 1);
		const url = new URL(
			`${API_BASE_URL}/facilities/${CARTOUCHE_FACILITY_ID}/matches`
		);
		url.searchParams.set("filter[dateStart]", format(startDate, "yyyy-MM-dd"));
		url.searchParams.set("filter[dateEnd]", format(endDate, "yyyy-MM-dd"));

		try {
			const body = await signedGet(url);
			const schedule = body?.data?.matches ?? [];
			globalStore.liveScheduleCache = {
				data: schedule,
				expiresAt: Date.now() + SCHEDULE_CACHE_TTL_MS,
			};
			return schedule;
		} catch (error) {
			if (
				previousSchedule &&
				error instanceof SignedRequestError &&
				error.status === 429
			) {
				return previousSchedule;
			}

			throw error;
		}
	})();

	globalStore.liveScheduleRequest = pendingRequest;

	try {
		return await pendingRequest;
	} finally {
		if (globalStore.liveScheduleRequest === pendingRequest) {
			globalStore.liveScheduleRequest = null;
		}
	}
}

function selectTrackedHomeMatch(matches, now = Date.now()) {
	return matches
		.filter((match) => {
			const startsAt = new Date(match.date).getTime();
			return (
				TRACKED_HOME_TEAMS.has(match.home?.id) &&
				!STOPPED_STATUSES.has(match.status) &&
				!globalStore.completedLiveMatches.has(match.id) &&
				Number.isFinite(startsAt) &&
				now >= startsAt - PRE_MATCH_WINDOW_MS &&
				now <= startsAt + MAX_MATCH_WINDOW_MS
			);
		})
		.sort((left, right) => {
			if (left.status === "live" && right.status !== "live") return -1;
			if (right.status === "live" && left.status !== "live") return 1;
			return new Date(left.date) - new Date(right.date);
		})[0] ?? null;
}

async function fetchLiveMatchDetail(matchId) {
	const cachedEntry = globalStore.liveDetailCache.get(matchId);
	if (cachedEntry?.expiresAt > Date.now()) return cachedEntry.data;

	if (globalStore.liveDetailRequests.has(matchId)) {
		return globalStore.liveDetailRequests.get(matchId);
	}

	if (globalStore.rateLimitedUntil > Date.now()) return cachedEntry?.data ?? null;

	const pendingRequest = (async () => {
		try {
			const url = new URL(`${API_BASE_URL}/matches/${matchId}`);
			const body = await signedGet(url);
			const detail = body?.data ?? body;
			globalStore.liveDetailCache.set(matchId, {
				data: detail,
				expiresAt: Date.now() + LIVE_DETAIL_CACHE_TTL_MS,
			});
			return detail;
		} catch (error) {
			if (error instanceof SignedRequestError) {
				return cachedEntry?.data ?? null;
			}

			throw error;
		}
	})();

	globalStore.liveDetailRequests.set(matchId, pendingRequest);

	try {
		return await pendingRequest;
	} finally {
		globalStore.liveDetailRequests.delete(matchId);
	}
}

function normalizeLiveMatch(match) {
	return {
		id: match.id,
		datetime: match.date,
		field: match.location?.field?.name ?? null,
		competition: match.competition_name ?? match.poule_name ?? "",
		status: match.status,
		home_score: match.score?.home ?? null,
		away_score: match.score?.away ?? null,
		home_team: {
			id: match.home?.id ?? null,
			name: match.home?.name ?? "Cartouche",
			logo: match.home?.logo ?? null,
			club_name: match.home?.name ?? "Cartouche",
			short_name: match.home?.short_name ?? null,
		},
		away_team: {
			id: match.away?.id ?? null,
			name: match.away?.name ?? "Tegenstander",
			logo: match.away?.logo ?? null,
			club_name: match.away?.name ?? "Tegenstander",
			short_name: match.away?.short_name ?? null,
		},
		team_label: TRACKED_HOME_TEAMS.get(match.home?.id) ?? null,
		actions: Array.isArray(match.actions)
			? match.actions.map((action) => ({
					id: action.id,
					action: action.action,
					action_type: action.action_type,
					side: action.side,
					person_name: action.person_name,
					seconds_since_start: action.seconds_since_start,
			  }))
			: [],
	};
}

async function fetchLivePayload() {
	const schedule = await fetchLiveSchedule();
	const candidate = selectTrackedHomeMatch(schedule);

	if (!candidate) {
		return { active: false, match: null, pollAfterMs: LIVE_DETAIL_CACHE_TTL_MS };
	}

	const detail = await fetchLiveMatchDetail(candidate.id);
	if (!detail) {
		return { active: false, match: null, pollAfterMs: LIVE_DETAIL_CACHE_TTL_MS };
	}

	const match = normalizeLiveMatch(detail);
	const isFinished = STOPPED_STATUSES.has(match.status);

	if (isFinished) globalStore.completedLiveMatches.add(match.id);

	return {
		active: !isFinished,
		match,
		pollAfterMs: LIVE_DETAIL_CACHE_TTL_MS,
	};
}

function sendResponse(res, payload) {
	res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=2");
	res.status(200).json(payload);
}

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		res.status(405).json({ error: "Method not allowed" });
		return;
	}

	if (
		globalStore.latestLiveResponse &&
		globalStore.latestLiveResponse.expiresAt > Date.now()
	) {
		sendResponse(res, globalStore.latestLiveResponse.payload);
		return;
	}

	const pendingRequest = globalStore.latestLiveRequest ?? fetchLivePayload();
	globalStore.latestLiveRequest = pendingRequest;

	try {
		const payload = await pendingRequest;
		globalStore.latestLiveResponse = {
			payload,
			expiresAt: Date.now() + LIVE_RESPONSE_CACHE_TTL_MS,
		};
		sendResponse(res, payload);
	} catch (error) {
		console.error("Failed to fetch Cartouche live match", error);
		sendResponse(res, { active: false, match: null, pollAfterMs: LIVE_DETAIL_CACHE_TTL_MS });
	} finally {
		if (globalStore.latestLiveRequest === pendingRequest) {
			globalStore.latestLiveRequest = null;
		}
	}
}
