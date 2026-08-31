import { listTrainingSessions } from "@/lib/training-sessions";

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");

	try {
		return res.status(200).json({
			sessions: await listTrainingSessions({ currentSeasonOnly: true }),
		});
	} catch (error) {
		console.error("Publiek trainingsschema laden is mislukt", error);
		return res.status(200).json({ sessions: [] });
	}
}
