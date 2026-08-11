import { listSponsors } from "@/lib/sponsors";

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	try {
		const sponsors = await listSponsors();
		res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
		return res.status(200).json({ sponsors, fetchedAt: new Date().toISOString() });
	} catch (error) {
		console.error("Sponsoren laden uit Neon is mislukt", error);
		return res.status(500).json({ error: "Sponsoren konden niet worden geladen" });
	}
}
