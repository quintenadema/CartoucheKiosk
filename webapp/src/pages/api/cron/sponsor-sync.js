import { syncSponsorsFromClubSite } from "@/lib/sponsor-sync";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
		return res.status(401).json({ error: "Niet toegestaan" });
	}

	try {
		const result = await syncSponsorsFromClubSite();
		return res.status(200).json({ ok: true, ...result });
	} catch (error) {
		console.error("Automatische sponsorsynchronisatie is mislukt", error);
		return res.status(500).json({ error: error.message || "Synchronisatie is mislukt" });
	}
}
