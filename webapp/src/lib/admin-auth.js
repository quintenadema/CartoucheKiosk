import { auth } from "@/lib/auth";

function requestHeaders(req) {
	const headers = new Headers();

	for (const [name, value] of Object.entries(req.headers ?? {})) {
		if (Array.isArray(value)) {
			for (const item of value) headers.append(name, item);
		} else if (value !== undefined) {
			headers.set(name, value);
		}
	}

	return headers;
}

function allowedAdminEmails() {
	return new Set(
		String(process.env.ADMIN_EMAILS ?? "")
			.split(",")
			.map((email) => email.trim().toLowerCase())
			.filter(Boolean)
	);
}

export async function getAdminSession(req) {
	const session = await auth.api.getSession({ headers: requestHeaders(req) });

	if (!session?.user?.email) return null;

	const allowedEmails = allowedAdminEmails();
	if (!allowedEmails.has(session.user.email.toLowerCase())) return null;

	return session;
}

export async function requireAdmin(req, res) {
	const session = await getAdminSession(req);

	if (!session) {
		res.status(401).json({ error: "Niet ingelogd als beheerder" });
		return null;
	}

	return session;
}
