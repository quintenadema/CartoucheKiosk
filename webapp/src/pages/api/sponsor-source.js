import { createHash, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { parseClubSponsors, syncSponsorsFromClubSite } from "@/lib/sponsor-sync";

export const config = { api: { bodyParser: { sizeLimit: "2mb" } }, maxDuration: 120 };

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "no-store");
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "Method not allowed" });
	}
	const secret = process.env.CLUB_CONTENT_SYNC_TOKEN;
	const hash = value => createHash("sha256").update(value).digest();
	if (!secret || !timingSafeEqual(hash(String(req.headers.authorization ?? "")), hash(`Bearer ${secret}`))) {
		return res.status(401).json({ error: "Unauthorized" });
	}
	const html = typeof req.body?.html === "string" ? req.body.html : "";
	const sponsors = parseClubSponsors(html);
	if (!sponsors.length) return res.status(422).json({ error: "Invalid sponsor source; previous snapshot retained" });
	try {
		await getSql()`INSERT INTO sponsor_source_snapshot (id, html) VALUES ('club-site', ${html})
			ON CONFLICT (id) DO UPDATE SET html = EXCLUDED.html, updated_at = now()`;
		// Retrying on relay updates also recovers a failed cron run. The sync's
		// enabled flag and due-time check still enforce the user's preferences.
		const result = await syncSponsorsFromClubSite();
		return res.status(200).json({ received: sponsors.length, ...result });
	} catch (error) {
		console.error("Sponsor relay failed", error);
		return res.status(502).json({ error: error.message || "Sponsor relay failed" });
	}
}
