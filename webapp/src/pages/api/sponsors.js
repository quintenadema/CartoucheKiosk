import { DATABASE_SNAPSHOT_CACHE_CONTROL } from "@/lib/database-refresh";
import { listSponsors } from "@/lib/sponsors";

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	try {
		const sponsors = await listSponsors();
		res.setHeader("Cache-Control", DATABASE_SNAPSHOT_CACHE_CONTROL);
		return res.status(200).json({ sponsors, fetchedAt: new Date().toISOString() });
	} catch (error) {
		console.error("Sponsoren laden uit Neon is mislukt", error);
		res.setHeader("Cache-Control", "no-store");
		return res.status(500).json({ error: "Sponsoren konden niet worden geladen" });
	}
}
