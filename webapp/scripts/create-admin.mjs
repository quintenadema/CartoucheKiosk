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

const [emailArgument, ...nameParts] = process.argv.slice(2);
const email = String(emailArgument ?? "").trim().toLowerCase();
const name = nameParts.join(" ").trim() || "Cartouche beheerder";

if (!email || !email.includes("@")) {
	throw new Error('Gebruik: bun run admin:create -- beheerder@example.com "Naam Beheerder"');
}

const password = await readHidden("Nieuw wachtwoord (minimaal 12 tekens): ");
if (password.length < 12) throw new Error("Het wachtwoord moet minimaal 12 tekens lang zijn.");

process.env.ALLOW_ADMIN_SIGNUP = "true";
const { auth } = await import("../src/lib/auth.js");
const result = await auth.api.signUpEmail({ body: { email, password, name } });

console.log(`Beheerder aangemaakt: ${result.user.email}`);
