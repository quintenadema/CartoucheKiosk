import { del } from "@vercel/blob";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteSponsor, listSponsors, updateSponsor } from "@/lib/sponsors";
import { validateSponsorInput } from "@/lib/sponsor-input";

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;

	const id = String(req.query.id ?? "");
	if (!/^[0-9a-f-]{36}$/i.test(id)) {
		return res.status(400).json({ error: "Ongeldig sponsor-ID" });
	}

	if (req.method === "PUT") {
		let existing;
		let input;
		try {
			existing = (await listSponsors({ includeInactive: true })).find(
				(sponsor) => sponsor.id === id
			);
			if (!existing) return res.status(404).json({ error: "Sponsor niet gevonden" });

			input = validateSponsorInput(req.body);
			const sponsor = await updateSponsor(id, input);

			if (existing.blobPathname !== input.blobPathname) {
				await del(existing.blobPathname).catch((error) =>
					console.error("Oud sponsorlogo verwijderen is mislukt", error)
				);
			}
			if (
				existing.featuredBlobPathname &&
				existing.featuredBlobPathname !== input.featuredBlobPathname
			) {
				await del(existing.featuredBlobPathname).catch((error) =>
					console.error("Oude uitgelichte sponsorfoto verwijderen is mislukt", error)
				);
			}

			return res.status(200).json({ sponsor });
		} catch (error) {
			if (input?.blobPathname && existing?.blobPathname !== input.blobPathname) {
				await del(input.blobPathname).catch(() => undefined);
			}
			if (
				input?.featuredBlobPathname &&
				existing?.featuredBlobPathname !== input.featuredBlobPathname
			) {
				await del(input.featuredBlobPathname).catch(() => undefined);
			}
			console.error("Sponsor bijwerken is mislukt", error);
			return res.status(400).json({ error: error.message || "Sponsor kon niet worden bijgewerkt" });
		}
	}

	if (req.method === "DELETE") {
		try {
			const deleted = await deleteSponsor(id);
			if (!deleted) return res.status(404).json({ error: "Sponsor niet gevonden" });

			await del(deleted.blob_pathname).catch((error) =>
				console.error("Sponsorlogo verwijderen is mislukt", error)
			);
			if (deleted.featured_blob_pathname) {
				await del(deleted.featured_blob_pathname).catch((error) =>
					console.error("Uitgelichte sponsorfoto verwijderen is mislukt", error)
				);
			}
			return res.status(204).end();
		} catch (error) {
			console.error("Sponsor verwijderen is mislukt", error);
			return res.status(500).json({ error: "Sponsor kon niet worden verwijderd" });
		}
	}

	res.setHeader("Allow", "PUT, DELETE");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
