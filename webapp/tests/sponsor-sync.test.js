import { describe, expect, mock, test } from "bun:test";
import { parseClubSponsors, SPONSOR_SOURCE_URL, syncSponsorsFromClubSite } from "../src/lib/sponsor-sync.js";

const source = {
	txt_Name: "Club sponsor",
	imgSponsor: "https://storage.knltb.club/clubid-1517/SponsorLogo/42/new.png",
	lnkSponsor: "https://example.com/",
};

function page(sponsors = [source]) {
	return `<div data-widget-config="${Buffer.from(JSON.stringify({ lstSponsors: sponsors })).toString("base64")}"></div>`;
}

function harness({ enabled = true, locked = true, lastSuccess = null, rows = [], response, logoResponse, snapshot = null } = {}) {
	const queries = [];
	const query = mock(async (sql, values = []) => {
		const text = sql.replace(/\s+/g, " ").trim();
		queries.push({ text, values });
		if (text.includes("pg_try_advisory_lock")) return { rows: [{ locked }] };
		if (text.startsWith("SELECT enabled")) {
			return { rows: [{ enabled, last_success_at: lastSuccess }] };
		}
		if (text.startsWith("SELECT id")) return { rows: structuredClone(rows) };
		if (text.startsWith("SELECT html")) return { rows: snapshot ? [{ html: snapshot }] : [] };
		return { rows: [], rowCount: 0 };
	});
	const release = mock(() => {});
	const end = mock(async () => {});
	const fetchSource = mock(async (url) => url === SPONSOR_SOURCE_URL
		? (response ?? new Response(page()))
		: (logoResponse ?? new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { headers: { "content-type": "image/png" } })));
	const upload = mock(async () => ({ url: "https://blob.example/new.png", pathname: "sponsors/imported/new.png" }));
	const remove = mock(async () => {});
	const dependencies = {
		createPool: () => ({ connect: async () => ({ query, release }), end }),
		fetch: fetchSource,
		put: upload,
		del: remove,
	};
	return {
		run: (options) => syncSponsorsFromClubSite(options, dependencies),
		queries, fetchSource, upload, remove, release, end,
	};
}

const existing = {
	id: "existing-sponsor",
	name: "Old sponsor name",
	image_url: "https://blob.example/old.png",
	blob_pathname: "sponsors/imported/old.png",
	website_url: source.lnkSponsor,
	sort_order: 10,
	sync_source_key: "club-site:42",
	sync_source_image_url: source.imgSponsor,
	sync_present: true,
	active: false,
	featured: true,
	featured_image_url: "https://blob.example/highlight.jpg",
	featured_blob_pathname: "sponsors/featured/highlight.jpg",
};

describe("club sponsor parsing", () => {
	test("extracts stable source IDs despite a renamed sponsor or changed logo filename", () => {
		const [first] = parseClubSponsors(page());
		const [changed] = parseClubSponsors(page([{ ...source, txt_Name: "Renamed", imgSponsor: source.imgSponsor.replace("new.png", "updated.jpg") }]));
		expect(first.sourceKey).toBe("club-site:42");
		expect(changed.sourceKey).toBe(first.sourceKey);
	});

	test("deduplicates source IDs, trims names and ignores incomplete entries", () => {
		const parsed = parseClubSponsors(page([source, source, { txt_Name: "Missing logo" }, { ...source, txt_Name: "  " }]));
		expect(parsed).toHaveLength(1);
		expect(parseClubSponsors(page([{ ...source, txt_Name: "  Sponsor  " }]))[0].name).toBe("Sponsor");
	});

	test("skips unrelated and malformed widgets", () => {
		expect(parseClubSponsors(`<div data-widget-config="broken"></div>${page()}`)).toHaveLength(1);
		expect(parseClubSponsors("<html>Access denied</html>")).toEqual([]);
	});
});

describe("sync failure regression", () => {
	test("Vercel 403 recovers using a fresh authenticated relay snapshot", async () => {
		const h = harness({ response: new Response("Forbidden", { status: 403 }), snapshot: page(), rows: [existing] });
		expect(await h.run()).toMatchObject({ skipped: false, stats: { found: 1, updated: 1 } });
		expect(h.queries.find(q => q.text.startsWith("SELECT html")).text).toContain("updated_at > NOW() - INTERVAL '24 hours'");
		expect(h.queries.some(q => q.text.includes("SET last_success_at"))).toBe(true);
	});

	test("an invalid relay snapshot cannot turn a 403 into a successful empty sync", async () => {
		const h = harness({ response: new Response("Forbidden", { status: 403 }), snapshot: "Access denied" });
		await expect(h.run()).rejects.toThrow("Clubsite gaf status 403");
		expect(h.queries.some(q => /^(UPDATE|INSERT INTO) sponsors\b/.test(q.text))).toBe(false);
	});
	test.each([403, 429, 500])("upstream %i records failure without changing sponsors, blobs or last success", async (status) => {
		const h = harness({ response: new Response("Access denied", { status }), rows: [existing] });
		await expect(h.run({ force: true })).rejects.toThrow(`Clubsite gaf status ${status}`);
		expect(h.queries.some(q => /^(UPDATE|INSERT INTO) sponsors\b/.test(q.text))).toBe(false);
		expect(h.queries.some(q => q.text.includes("SET last_success_at"))).toBe(false);
		expect(h.queries.find(q => q.text.includes("SET last_error = $1"))?.values).toEqual([`Clubsite gaf status ${status}`]);
		expect(h.upload).not.toHaveBeenCalled();
		expect(h.remove).not.toHaveBeenCalled();
		expect(h.queries.some(q => q.text.includes("pg_advisory_unlock"))).toBe(true);
		expect(h.release).toHaveBeenCalledTimes(1);
		expect(h.end).toHaveBeenCalledTimes(1);
	});

	test.each(["<html>Access denied</html>", page([])])("HTTP 200 with no sponsors is an error, never a removal signal", async (html) => {
		const h = harness({ response: new Response(html) });
		await expect(h.run()).rejects.toThrow("Geen sponsoren");
		expect(h.queries.some(q => /^(UPDATE|INSERT INTO) sponsors\b/.test(q.text))).toBe(false);
		expect(h.queries.some(q => q.text.includes("SET last_success_at"))).toBe(false);
	});

	test("network failures are recorded and release the sync lock", async () => {
		const h = harness();
		h.fetchSource.mockRejectedValueOnce(new Error("Connection timed out"));
		await expect(h.run()).rejects.toThrow("Connection timed out");
		expect(h.queries.find(q => q.text.includes("SET last_error = $1"))?.values).toEqual(["Connection timed out"]);
		expect(h.release).toHaveBeenCalledTimes(1);
	});

	test("logo 403 cannot replace an existing logo or mark the sync successful", async () => {
		const h = harness({ rows: [{ ...existing, sync_source_image_url: "https://example.com/previous.png" }], logoResponse: new Response("Forbidden", { status: 403 }) });
		await expect(h.run()).rejects.toThrow("Logo van Club sponsor gaf status 403");
		expect(h.queries.some(q => /^(UPDATE|INSERT INTO) sponsors\b/.test(q.text))).toBe(false);
		expect(h.remove).not.toHaveBeenCalled();
		expect(h.upload).not.toHaveBeenCalled();
	});
});

describe("schedule and sponsor preferences", () => {
	test.each([
		[{ enabled: false }, "disabled"],
		[{ locked: false }, "already-running"],
		[{ lastSuccess: new Date().toISOString() }, "not-due"],
	])("skips safely when not eligible: %j", async (settings, reason) => {
		const h = harness(settings);
		expect(await h.run()).toMatchObject({ skipped: true, reason });
		expect(h.fetchSource).not.toHaveBeenCalled();
		expect(h.release).toHaveBeenCalledTimes(1);
	});

	test("a due sync updates source fields while preserving visibility and highlight columns", async () => {
		const h = harness({ rows: [existing], lastSuccess: new Date(Date.now() - 13 * 3600_000).toISOString() });
		expect(await h.run()).toMatchObject({ skipped: false, stats: { updated: 1, created: 0 } });
		const update = h.queries.find(q => q.text.startsWith("UPDATE sponsors SET name"));
		expect(update.values[0]).toBe("Club sponsor");
		expect(update.values.at(-1)).toBe(existing.id);
		expect(update.text).not.toMatch(/\b(active|featured|featured_image_url|featured_blob_pathname)\s*=/);
		expect(h.upload).not.toHaveBeenCalled();
		expect(h.queries.some(q => q.text.includes("SET last_success_at"))).toBe(true);
	});

	test("unchanged records do not reupload logos", async () => {
		const h = harness({ rows: [{ ...existing, name: source.txt_Name }] });
		expect(await h.run()).toMatchObject({ stats: { unchanged: 1, created: 0, updated: 0 } });
		expect(h.upload).not.toHaveBeenCalled();
	});

	test("new sponsors are mirrored before insertion", async () => {
		const h = harness();
		expect(await h.run()).toMatchObject({ stats: { created: 1 } });
		expect(h.upload).toHaveBeenCalledTimes(1);
		const insert = h.queries.find(q => q.text.startsWith("INSERT INTO sponsors"));
		expect(insert.values.slice(0, 3)).toEqual(["Club sponsor", "https://blob.example/new.png", "sponsors/imported/new.png"]);
	});
});
