// Neon's free plan only suspends the database after ~5 idle minutes, so any
// request that reaches it keeps it awake for at least that long. To stay within
// the monthly compute quota, database-backed responses are cached at the CDN
// for 50 minutes and kiosks request them together once an hour, a few minutes
// after the Pi's hourly content sync. The database then wakes about once an
// hour instead of staying awake around the clock.
export const DATABASE_SNAPSHOT_CACHE_CONTROL = "public, s-maxage=3000, stale-if-error=86400";

const REFRESH_PERIOD_MS = 60 * 60 * 1000;
const REFRESH_OFFSET_MS = 2 * 60 * 1000;

// Calls `callback` at the same wall-clock minute every hour; returns a cleanup function.
export function setHourlyDatabaseRefresh(callback) {
	let timeout;
	const schedule = () => {
		const now = Date.now();
		const next = Math.ceil((now - REFRESH_OFFSET_MS) / REFRESH_PERIOD_MS) * REFRESH_PERIOD_MS + REFRESH_OFFSET_MS;
		timeout = setTimeout(() => {
			callback();
			schedule();
		}, Math.max(1000, next - now));
	};
	schedule();
	return () => clearTimeout(timeout);
}
