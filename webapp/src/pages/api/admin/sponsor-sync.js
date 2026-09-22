import { requireAdmin } from "@/lib/admin-auth";
import {
	getSponsorSyncSettings,
	setSponsorSyncEnabled,
	SPONSOR_SOURCE_URL,
	syncSponsorsFromClubSite,
} from "@/lib/sponsor-sync";
import { listSponsors } from "@/lib/sponsors";

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;
	res.setHeader("Cache-Control", "no-store");

	if (req.method === "GET") {
		try {
			return res.status(200).json({
				settings: await getSponsorSyncSettings(),
				sourceUrl: SPONSOR_SOURCE_URL,
			});
		} catch (error) {
			console.error("Sponsorsynchronisatie-instellingen laden is mislukt", error);
			return res.status(500).json({ error: "Synchronisatie-instellingen konden niet worden geladen" });
		}
	}

	if (req.method === "PUT") {
		if (typeof req.body?.enabled !== "boolean") {
			return res.status(400).json({ error: "Ongeldige synchronisatie-instelling" });
		}

		try {
			await setSponsorSyncEnabled(req.body.enabled);
			let syncResult = null;
			if (req.body.enabled) syncResult = await syncSponsorsFromClubSite({ force: true });

			return res.status(200).json({
				settings: await getSponsorSyncSettings(),
				sponsors: await listSponsors({ includeInactive: true }),
				syncResult,
			});
		} catch (error) {
			console.error("Sponsorsynchronisatie aanpassen is mislukt", error);
			return res.status(502).json({
				error: error.message || "Sponsorsynchronisatie is mislukt",
				settings: await getSponsorSyncSettings().catch(() => null),
			});
		}
	}

	res.setHeader("Allow", "GET, PUT");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
