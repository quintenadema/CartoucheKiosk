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

	headers.set("content-type", "application/json");
	return headers;
}

function copyResponseHeaders(response, res) {
	const setCookies = response.headers.getSetCookie?.() ?? [];
	if (setCookies.length > 0) res.setHeader("Set-Cookie", setCookies);

	for (const name of ["X-Retry-After", "Retry-After"]) {
		const value = response.headers.get(name);
		if (value) res.setHeader(name, value);
	}
}

export default async function handler(req, res) {
	res.setHeader("Cache-Control", "no-store");

	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "Methode niet toegestaan" });
	}

	const password = typeof req.body?.password === "string" ? req.body.password : "";
	const email = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase();

	if (!email || !password || password.length > 128) {
		return res.status(email ? 401 : 503).json({ error: "Inloggen is niet beschikbaar" });
	}

	const baseUrl = process.env.BETTER_AUTH_URL || `${req.headers["x-forwarded-proto"] || "http"}://${req.headers.host}`;
	const authResponse = await auth.handler(
		new Request(new URL("/api/auth/sign-in/email", baseUrl), {
			method: "POST",
			headers: requestHeaders(req),
			body: JSON.stringify({ email, password, rememberMe: false }),
		})
	);

	copyResponseHeaders(authResponse, res);

	if (!authResponse.ok) {
		if (authResponse.status === 429) {
			return res.status(429).json({ error: "Te veel inlogpogingen" });
		}
		return res.status(authResponse.status >= 500 ? 503 : 401).json({ error: "Ongeldig wachtwoord" });
	}

	return res.status(200).json({ ok: true });
}
