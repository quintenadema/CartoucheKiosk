import { handleUpload } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/admin-auth";

export default async function handler(req, res) {
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	try {
		const response = await handleUpload({
			body: req.body,
			request: req,
			onBeforeGenerateToken: async (pathname) => {
				if (!(await getAdminSession(req))) throw new Error("Niet ingelogd als beheerder");

				const filename = pathname.split("/").pop()?.replace(/[^a-zA-Z0-9._-]/g, "-") || "logo";
				if (pathname !== `sponsors/${filename}`) throw new Error("Ongeldig uploadpad");

				return {
					allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
					maximumSizeInBytes: 4 * 1024 * 1024,
					addRandomSuffix: true,
					tokenPayload: JSON.stringify({ kind: "sponsor-logo" }),
				};
			},
			onUploadCompleted: async () => undefined,
		});

		return res.status(200).json(response);
	} catch (error) {
		console.error("Sponsorlogo uploaden is mislukt", error);
		return res.status(400).json({ error: error.message || "Upload mislukt" });
	}
}
