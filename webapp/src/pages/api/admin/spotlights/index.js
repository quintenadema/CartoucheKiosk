import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth";
import { validateSpotlightInput } from "@/lib/spotlight-input";
import { createSpotlight, listSpotlights } from "@/lib/spotlights";

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;

	if (req.method === "GET") {
		try {
			return res.status(200).json({
				spotlights: await listSpotlights({ includeInactive: true }),
			});
		} catch (error) {
			console.error("Beheerlijst uitlichtingen laden is mislukt", error);
			return res.status(500).json({ error: "Uitlichtingen konden niet worden geladen" });
		}
	}

	if (req.method === "POST") {
		let input;
		try {
			input = validateSpotlightInput(req.body);
			const spotlight = await createSpotlight(input);
			return res.status(201).json({ spotlight });
		} catch (error) {
			if (input?.blobPathname) await del(input.blobPathname).catch(() => undefined);
			console.error("Uitlichting toevoegen is mislukt", error);
			return res.status(400).json({ error: error.message || "Uitlichting kon niet worden toegevoegd" });
		}
	}

	res.setHeader("Allow", "GET, POST");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
