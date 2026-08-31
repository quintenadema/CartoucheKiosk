import { requireAdmin } from "@/lib/admin-auth";
import { validateTrainingInput } from "@/lib/training-input";
import { deleteTrainingSession, updateTrainingSession } from "@/lib/training-sessions";

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;

	const id = String(req.query.id ?? "");
	if (!/^[0-9a-f-]{36}$/i.test(id)) {
		return res.status(400).json({ error: "Ongeldig training-ID" });
	}

	if (req.method === "PUT") {
		try {
			const input = validateTrainingInput(req.body);
			const session = await updateTrainingSession(id, input);
			if (!session) return res.status(404).json({ error: "Training niet gevonden" });
			return res.status(200).json({ session });
		} catch (error) {
			console.error("Training bijwerken is mislukt", error);
			return res.status(400).json({ error: error.message || "Training kon niet worden bijgewerkt" });
		}
	}

	if (req.method === "DELETE") {
		try {
			const deleted = await deleteTrainingSession(id);
			if (!deleted) return res.status(404).json({ error: "Training niet gevonden" });
			return res.status(204).end();
		} catch (error) {
			console.error("Training verwijderen is mislukt", error);
			return res.status(500).json({ error: "Training kon niet worden verwijderd" });
		}
	}

	res.setHeader("Allow", "PUT, DELETE");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
