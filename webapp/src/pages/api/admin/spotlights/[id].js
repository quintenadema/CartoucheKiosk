import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth";
import { validateSpotlightInput } from "@/lib/spotlight-input";
import { deleteSpotlight, listSpotlights, updateSpotlight } from "@/lib/spotlights";

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;

	const id = String(req.query.id ?? "");
	if (!/^[0-9a-f-]{36}$/i.test(id)) {
		return res.status(400).json({ error: "Ongeldig uitlichting-ID" });
	}

	if (req.method === "PUT") {
		let existing;
		let input;
		try {
			existing = (await listSpotlights({ includeInactive: true })).find(
				(spotlight) => spotlight.id === id
			);
			if (!existing) return res.status(404).json({ error: "Uitlichting niet gevonden" });

			input = validateSpotlightInput(req.body);
			const spotlight = await updateSpotlight(id, input);

			if (existing.blobPathname !== input.blobPathname) {
				await del(existing.blobPathname).catch((error) =>
					console.error("Oude uitlichtingsfoto verwijderen is mislukt", error)
				);
			}

			return res.status(200).json({ spotlight });
		} catch (error) {
			if (input?.blobPathname && existing?.blobPathname !== input.blobPathname) {
				await del(input.blobPathname).catch(() => undefined);
			}
			console.error("Uitlichting bijwerken is mislukt", error);
			return res.status(400).json({ error: error.message || "Uitlichting kon niet worden bijgewerkt" });
		}
	}

	if (req.method === "DELETE") {
		try {
			const deleted = await deleteSpotlight(id);
			if (!deleted) return res.status(404).json({ error: "Uitlichting niet gevonden" });

			await del(deleted.blob_pathname).catch((error) =>
				console.error("Uitlichtingsfoto verwijderen is mislukt", error)
			);
			return res.status(204).end();
		} catch (error) {
			console.error("Uitlichting verwijderen is mislukt", error);
			return res.status(500).json({ error: "Uitlichting kon niet worden verwijderd" });
		}
	}

	res.setHeader("Allow", "PUT, DELETE");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
