import { DATABASE_SNAPSHOT_CACHE_CONTROL } from "@/lib/database-refresh";
import { listTrainingSessions } from "@/lib/training-sessions";

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	try {
		const sessions = await listTrainingSessions({ currentSeasonOnly: true });
		res.setHeader("Cache-Control", DATABASE_SNAPSHOT_CACHE_CONTROL);
		return res.status(200).json({ sessions });
	} catch (error) {
		console.error("Publiek trainingsschema laden is mislukt", error);
		res.setHeader("Cache-Control", "no-store");
		return res.status(503).json({ error: "Trainingsschema tijdelijk niet beschikbaar" });
	}
}
