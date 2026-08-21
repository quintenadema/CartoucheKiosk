import Head from "next/head";
import Image from "next/image";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/router";
import { useState } from "react";

export default function AdminLogin() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(event) {
		event.preventDefault();
		setLoading(true);
		setError("");

		const response = await fetch("/api/admin/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password }),
		});

		if (!response.ok) {
			setError(
				response.status === 429
					? "Te veel inlogpogingen. Wacht even en probeer het opnieuw."
					: "Het wachtwoord klopt niet."
			);
			setLoading(false);
			return;
		}

		await router.replace("/");
	}

	return (
		<>
			<Head>
				<title>Inloggen | Cartouche Kioskbeheer</title>
				<meta name="robots" content="noindex,nofollow" />
			</Head>

			<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061b11] px-5 py-10 text-[#10261a]">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(244,197,66,0.18),transparent_28%),linear-gradient(145deg,#0d3b25_0%,#061b11_62%,#020b07_100%)]" />
				<div className="absolute -right-20 top-10 h-72 w-72 rounded-full border border-white/10" />
				<div className="absolute -right-8 top-24 h-48 w-48 rounded-full border border-white/10" />

				<section className="relative grid w-full max-w-4xl overflow-hidden rounded-[2rem] bg-[#f4f0e6] shadow-[0_40px_100px_rgba(0,0,0,0.45)] md:grid-cols-[0.82fr_1.18fr]">
					<div className="relative flex min-h-60 flex-col justify-between overflow-hidden bg-[#0c4a2c] p-8 text-white md:min-h-[570px] md:p-10">
						<div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:42px_42px]" />
						<div className="relative flex items-center gap-4">
							<div className="rounded-2xl bg-white p-3 shadow-lg">
								<Image src="/cartouche.png" alt="Cartouche" width={58} height={58} priority />
							</div>
							<div>
								<p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f4c542]">HC Cartouche</p>
								<p className="mt-1 text-2xl font-semibold">Kioskbeheer</p>
							</div>
						</div>
						<div className="relative hidden md:block">
							<p className="max-w-xs text-3xl font-medium leading-tight">De club in beeld, van eerste wedstrijd tot laatste sponsor.</p>
							<p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65">Deze omgeving is uitsluitend bedoeld voor beheerders van de schermen in het clubhuis en de Dome.</p>
						</div>
					</div>

					<div className="flex flex-col justify-center p-8 sm:p-12 md:p-16">
						<div className="mb-9 flex h-12 w-12 items-center justify-center rounded-full bg-[#0c4a2c]/10 text-[#0c4a2c]">
							<LockKeyhole className="h-5 w-5" />
						</div>
						<p className="text-xs font-bold uppercase tracking-[0.24em] text-[#917110]">Beveiligde omgeving</p>
						<h1 className="mt-3 text-4xl font-semibold tracking-tight">Welkom terug</h1>
						<p className="mt-3 text-base text-[#526057]">Vul het gezamenlijke clubwachtwoord in om de sponsoren op de schermen te beheren.</p>

						<form className="mt-9 space-y-5" onSubmit={handleSubmit}>
							<label className="block">
								<span className="mb-2 block text-sm font-semibold">Wachtwoord</span>
								<input
									type="password"
									autoComplete="current-password"
									value={password}
									onChange={(event) => setPassword(event.target.value)}
									required
									className="w-full rounded-xl border border-[#c9c3b5] bg-white px-4 py-3.5 outline-none transition focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
								/>
							</label>

							{error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

							<button
								type="submit"
								disabled={loading}
								className="group flex w-full items-center justify-between rounded-xl bg-[#0c4a2c] px-5 py-4 font-semibold text-white transition hover:bg-[#083b22] disabled:cursor-wait disabled:opacity-65"
							>
								<span>{loading ? "Controleren…" : "Inloggen"}</span>
								<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
							</button>
						</form>
					</div>
				</section>
			</main>
		</>
	);
}

export async function getServerSideProps(context) {
	const { getAdminSession } = await import("@/lib/admin-auth");
	const session = await getAdminSession(context.req);

	if (session) {
		return { redirect: { destination: "/", permanent: false } };
	}

	return { props: {} };
}
