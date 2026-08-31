import { requireAdmin } from "@/lib/admin-auth";
import { validateTrainingInput } from "@/lib/training-input";
import { createTrainingSession, listTrainingSessions } from "@/lib/training-sessions";

export default async function handler(req, res) {
	if (!(await requireAdmin(req, res))) return;

	if (req.method === "GET") {
		try {
			return res.status(200).json({
				sessions: await listTrainingSessions({ includeInactive: true }),
			});
		} catch (error) {
			console.error("Trainingsschema laden is mislukt", error);
			return res.status(500).json({ error: "Trainingsschema kon niet worden geladen" });
		}
	}

	if (req.method === "POST") {
		try {
			const input = validateTrainingInput(req.body);
			const session = await createTrainingSession(input);
			return res.status(201).json({ session });
		} catch (error) {
			console.error("Training toevoegen is mislukt", error);
			return res.status(400).json({ error: error.message || "Training kon niet worden toegevoegd" });
		}
	}

	res.setHeader("Allow", "GET, POST");
	return res.status(405).json({ error: "Methode niet toegestaan" });
}
