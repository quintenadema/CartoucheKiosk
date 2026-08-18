import { Pool } from "pg";
import { hashPassword } from "better-auth/crypto";

function readHidden(promptText) {
	return new Promise((resolve, reject) => {
		if (!process.stdin.isTTY) {
			reject(new Error("Start dit commando in een interactieve terminal."));
			return;
		}

		let value = "";
		process.stdout.write(promptText);
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.setEncoding("utf8");

		const finish = () => {
			process.stdin.setRawMode(false);
			process.stdin.pause();
			process.stdin.off("data", onData);
			process.stdout.write("\n");
			resolve(value);
		};

		const onData = (input) => {
			for (const character of input) {
				if (character === "\u0003") {
					process.stdin.setRawMode(false);
					process.stdin.pause();
					reject(new Error("Afgebroken"));
					return;
				}
				if (character === "\r" || character === "\n") return finish();
				if (character === "\u007f") {
					value = value.slice(0, -1);
					continue;
				}
				value += character;
			}
		};

		process.stdin.on("data", onData);
	});
}

const email = String(process.argv[2] ?? "").trim().toLowerCase();
if (!email || !email.includes("@")) {
	throw new Error("Gebruik: bun run admin:password -- beheerder@example.com");
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL ontbreekt.");

const password = await readHidden("Nieuw gezamenlijk wachtwoord (minimaal 12 tekens): ");
if (password.length < 12 || password.length > 128) {
	throw new Error("Het wachtwoord moet tussen 12 en 128 tekens lang zijn.");
}

const passwordHash = await hashPassword(password);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const client = await pool.connect();

try {
	await client.query("BEGIN");
	const userResult = await client.query('SELECT "id" FROM "user" WHERE lower("email") = $1 FOR UPDATE', [email]);
	if (userResult.rowCount !== 1) throw new Error(`Geen uniek account gevonden voor ${email}.`);

	const userId = userResult.rows[0].id;
	const accountResult = await client.query(
		'UPDATE "account" SET "password" = $1, "updatedAt" = now() WHERE "userId" = $2 AND "providerId" = $3',
		[passwordHash, userId, "credential"]
	);
	if (accountResult.rowCount !== 1) throw new Error("Geen uniek wachtwoordaccount gevonden.");

	const sessionResult = await client.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
	await client.query("COMMIT");
	console.log(`Wachtwoord bijgewerkt; ${sessionResult.rowCount} bestaande sessie(s) ingetrokken.`);
} catch (error) {
	await client.query("ROLLBACK");
	throw error;
} finally {
	client.release();
	await pool.end();
}
