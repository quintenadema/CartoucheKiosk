import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth";
import { createSponsor, listSponsors } from "@/lib/sponsors";
import { validateSponsorInput } from "@/lib/sponsor-input";

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;

	if (req.method === "GET") {
		try {
			return res.status(200).json({ sponsors: await listSponsors({ includeInactive: true }) });
		} catch (error) {
			console.error("Beheerlijst sponsoren laden is mislukt", error);
			return res.status(500).json({ error: "Sponsoren konden niet worden geladen" });
		}
	}

	if (req.method === "POST") {
		let input;
		try {
			input = validateSponsorInput(req.body);
			const sponsor = await createSponsor(input);
			return res.status(201).json({ sponsor });
		} catch (error) {
			if (input?.blobPathname) {
				await del(input.blobPathname).catch(() => undefined);
			}
			console.error("Sponsor toevoegen is mislukt", error);
			return res.status(400).json({ error: error.message || "Sponsor kon niet worden toegevoegd" });
		}
	}

	res.setHeader("Allow", "GET, POST");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
