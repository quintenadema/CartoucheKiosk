import { DATABASE_SNAPSHOT_CACHE_CONTROL } from "@/lib/database-refresh";
import { listSpotlights } from "@/lib/spotlights";

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	try {
		const spotlights = await listSpotlights();
		res.setHeader("Cache-Control", DATABASE_SNAPSHOT_CACHE_CONTROL);
		return res.status(200).json({ spotlights });
	} catch (error) {
		console.error("Uitlichtingen laden is mislukt", error);
		res.setHeader("Cache-Control", "no-store");
		return res.status(503).json({ error: "Uitlichtingen tijdelijk niet beschikbaar" });
	}
}
