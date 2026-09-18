import { upload } from "@vercel/blob/client";
import Head from "next/head";
import {
	Eye,
	EyeOff,
	ImagePlus,
	Images,
	Pencil,
	Plus,
	Search,
	Sparkles,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import AdminShell from "@/components/admin-shell";

const EMPTY_FORM = {
	id: null,
	title: "",
	imageUrl: "",
	blobPathname: "",
	sortOrder: 0,
	active: true,
};

function SpotlightEditor({ spotlight, onClose, onSaved }) {
	const [form, setForm] = useState({ ...EMPTY_FORM, ...(spotlight ?? {}) });
	const [file, setFile] = useState(null);
	const [preview, setPreview] = useState(spotlight?.imageUrl ?? "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [closing, setClosing] = useState(false);

	function closeSheet() {
		if (!closing) setClosing(true);
	}

	function finishClosing(event) {
		if (
			closing &&
			event.currentTarget === event.target &&
			event.animationName === "admin-sheet-out"
		) {
			onClose();
		}
	}

	function chooseFile(event) {
		const selected = event.target.files?.[0];
		if (!selected) return;
		setFile(selected);
		setPreview(URL.createObjectURL(selected));
	}

	async function save(event) {
		event.preventDefault();
		setSaving(true);
		setError("");

		try {
			let imageUrl = form.imageUrl;
			let blobPathname = form.blobPathname;

			if (file) {
				const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				const blob = await upload(`spotlights/${cleanName}`, file, {
					access: "public",
					handleUploadUrl: "/api/admin/upload",
				});
				imageUrl = blob.url;
				blobPathname = blob.pathname;
			}

			const response = await fetch(
				form.id ? `/api/admin/spotlights/${form.id}` : "/api/admin/spotlights",
				{
					method: form.id ? "PUT" : "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ ...form, imageUrl, blobPathname }),
				}
			);
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Opslaan is mislukt");

			onSaved(body.spotlight);
			closeSheet();
		} catch (saveError) {
			setError(saveError.message || "Opslaan is mislukt");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
			<button className={`admin-sheet-backdrop absolute inset-0 cursor-default bg-[#04150d]/65 backdrop-blur-sm ${closing ? "is-closing" : ""}`} onClick={closeSheet} aria-label="Sluiten" />
			<section className={`admin-side-sheet relative h-full w-full overflow-y-auto border-l border-black/10 bg-[#f7f4eb] p-6 shadow-[-32px_0_80px_rgba(0,0,0,0.28)] sm:max-w-[680px] sm:p-9 ${closing ? "is-closing" : ""}`} onAnimationEnd={finishClosing}>
				<div className="flex items-start justify-between gap-5">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a7914]">Club in beeld</p>
						<h2 className="mt-2 text-3xl font-semibold text-[#10261a]">{form.id ? "Uitlichting aanpassen" : "Uitlichting toevoegen"}</h2>
					</div>
					<button onClick={closeSheet} className="rounded-full border border-[#d9d2c2] p-2.5 text-[#536158] transition hover:bg-white" aria-label="Sluiten">
						<X className="h-5 w-5" />
					</button>
				</div>

				<form className="mt-8 space-y-6" onSubmit={save}>
					<div>
						<div className="mb-3">
							<span className="block text-sm font-semibold text-[#25382b]">Schermvullende afbeelding</span>
							<p className="mt-1 text-xs leading-relaxed text-[#6f735f]">Een liggende 16:9-foto werkt het mooist. De hele afbeelding blijft zichtbaar op het scherm.</p>
						</div>
						<label className="group flex aspect-video min-h-56 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#c8c0ad] bg-white transition hover:border-[#0c4a2c] hover:bg-[#f2f7f3]">
							{preview ? (
								<img src={preview} alt="Voorvertoning uitlichting" className="h-full w-full object-contain" />
							) : (
								<div className="px-6 text-center text-[#607067]">
									<ImagePlus className="mx-auto h-9 w-9 text-[#0c4a2c]" />
									<p className="mt-3 font-semibold">Kies een afbeelding</p>
									<p className="mt-1 text-xs">PNG, JPG of WebP · maximaal 4 MB</p>
								</div>
							)}
							<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} className="sr-only" required={!form.imageUrl} />
						</label>
					</div>

					<label className="block">
						<span className="mb-2 block text-sm font-semibold text-[#25382b]">Naam <span className="font-normal text-[#7a867e]">(alleen zichtbaar in beheer)</span></span>
						<input
							value={form.title}
							onChange={(event) => setForm({ ...form, title: event.target.value })}
							required
							maxLength={120}
							placeholder="Bijvoorbeeld Dames 1"
							className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
						/>
					</label>

					<div className="grid gap-5 sm:grid-cols-2">
						<label className="block">
							<span className="mb-2 block text-sm font-semibold text-[#25382b]">Volgorde</span>
							<input
								type="number"
								min="0"
								max="100000"
								value={form.sortOrder}
								onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })}
								className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
							/>
						</label>
						<label className="mt-7 flex items-center justify-between rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 text-sm font-semibold text-[#25382b]">
							Tonen op scherm
							<input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-5 w-5 accent-[#0c4a2c]" />
						</label>
					</div>

					<div className="rounded-2xl border border-[#d8c98f] bg-[#f4ecd3] px-4 py-3 text-sm leading-relaxed text-[#5f583c]">
						<Sparkles className="mr-2 inline h-4 w-4 text-[#8d6d0b]" />
						Actieve uitlichtingen komen om de beurt ongeveer elke vijf minuten 10 seconden groot in beeld.
					</div>

					{error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

					<div className="flex gap-3 border-t border-[#ded8ca] pt-6">
						<button type="button" onClick={closeSheet} className="flex-1 rounded-xl border border-[#bdb6a5] px-5 py-3.5 font-semibold text-[#34483a] transition hover:bg-white">Annuleren</button>
						<button type="submit" disabled={saving} className="flex-[1.4] rounded-xl bg-[#0c4a2c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#083b22] disabled:cursor-wait disabled:opacity-60">
							{saving ? "Opslaan…" : "Uitlichting opslaan"}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}

export default function SpotlightsPage({ initialSpotlights }) {
	const [spotlights, setSpotlights] = useState(initialSpotlights);
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState(undefined);
	const [message, setMessage] = useState("");

	const filteredSpotlights = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return normalized
			? spotlights.filter((spotlight) => spotlight.title.toLowerCase().includes(normalized))
			: spotlights;
	}, [query, spotlights]);

	function upsertSpotlight(spotlight) {
		setSpotlights((current) =>
			[...current.filter((item) => item.id !== spotlight.id), spotlight].sort(
				(left, right) => left.sortOrder - right.sortOrder || left.title.localeCompare(right.title)
			)
		);
		setMessage("De uitlichting is opgeslagen.");
	}

	async function removeSpotlight(spotlight) {
		if (!window.confirm(`Weet je zeker dat je ${spotlight.title} wilt verwijderen?`)) return;
		const response = await fetch(`/api/admin/spotlights/${spotlight.id}`, { method: "DELETE" });
		if (!response.ok) {
			setMessage("Verwijderen is mislukt. Probeer het opnieuw.");
			return;
		}
		setSpotlights((current) => current.filter((item) => item.id !== spotlight.id));
		setMessage(`${spotlight.title} is verwijderd.`);
	}

	async function toggleSpotlight(spotlight) {
		const response = await fetch(`/api/admin/spotlights/${spotlight.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...spotlight, active: !spotlight.active }),
		});
		const body = await response.json();
		if (response.ok) upsertSpotlight(body.spotlight);
		else setMessage(body.error || "Zichtbaarheid aanpassen is mislukt.");
	}

	return (
		<>
			<Head>
				<title>Uitlichtingen | Cartouche Kioskbeheer</title>
				<meta name="robots" content="noindex,nofollow" />
			</Head>

			<AdminShell activeItem="spotlights">
				<main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
					<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#957512]">Club in beeld</p>
							<h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Uitlichtingen</h1>
							<p className="mt-3 max-w-2xl text-[#5c6a61]">Zet teams, vrijwilligers en bijzondere clubmomenten af en toe schermvullend in de spotlights.</p>
						</div>
						<button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 self-start rounded-xl bg-[#0c4a2c] px-5 py-3 font-semibold text-white shadow-lg shadow-[#0c4a2c]/15 transition hover:bg-[#083b22] lg:self-auto">
							<Plus className="h-5 w-5" /> Uitlichting toevoegen
						</button>
					</div>

					<div className="mt-10 grid gap-4 sm:grid-cols-3">
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Images className="h-5 w-5 text-[#0c4a2c]" /><p className="mt-5 text-3xl font-semibold">{spotlights.length}</p><p className="mt-1 text-sm text-[#68756d]">Uitlichtingen totaal</p></div>
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Eye className="h-5 w-5 text-[#0c4a2c]" /><p className="mt-5 text-3xl font-semibold">{spotlights.filter((item) => item.active).length}</p><p className="mt-1 text-sm text-[#68756d]">Actief op scherm</p></div>
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Sparkles className="h-5 w-5 text-[#957512]" /><p className="mt-5 text-3xl font-semibold">10 sec</p><p className="mt-1 text-sm text-[#68756d]">Per vertoning</p></div>
					</div>

					{message ? <button onClick={() => setMessage("")} className="mt-6 w-full rounded-xl border border-[#b7d0bf] bg-[#e9f4ec] px-4 py-3 text-left text-sm text-[#18522f]">{message}</button> : null}

					<section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#d3ccbc] bg-[#f8f5ed]">
						<div className="flex flex-col justify-between gap-4 border-b border-[#ddd6c7] p-5 sm:flex-row sm:items-center sm:px-6">
							<div><h2 className="text-xl font-semibold">Alle uitlichtingen</h2><p className="mt-1 text-sm text-[#6b786f]">Actieve beelden verschijnen om de beurt</p></div>
							<label className="flex items-center gap-2 rounded-xl border border-[#cec6b5] bg-white px-3.5 py-2.5 text-[#66746b] focus-within:border-[#0c4a2c]">
								<Search className="h-4 w-4" /><span className="sr-only">Zoeken</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek uitlichting…" className="w-full bg-transparent text-sm text-[#10261a] outline-none sm:w-56" />
							</label>
						</div>

						{filteredSpotlights.length === 0 ? (
							<div className="px-6 py-20 text-center text-[#657269]"><ImagePlus className="mx-auto h-8 w-8" /><p className="mt-3 font-semibold">Nog geen uitlichtingen</p><p className="mt-1 text-sm">Voeg bijvoorbeeld een teamfoto van Dames 1 of Heren 1 toe.</p></div>
						) : (
							<ul className="divide-y divide-[#e0dacc]">
								{filteredSpotlights.map((spotlight) => (
									<li key={spotlight.id} className="grid items-center gap-4 px-5 py-4 transition hover:bg-white/70 sm:grid-cols-[112px_minmax(0,1fr)_110px_auto] sm:px-6">
										<div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-xl border border-[#ded7c9] bg-[#10261a]"><img src={spotlight.imageUrl} alt="" className="h-full w-full object-contain" /></div>
										<div className="min-w-0"><p className="truncate text-lg font-semibold">{spotlight.title}</p><p className="mt-1 text-sm text-[#788279]">Schermvullende clubfoto</p></div>
										<div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${spotlight.active ? "bg-[#e0f0e4] text-[#196039]" : "bg-[#e7e3d9] text-[#6d706b]"}`}><span className={`h-1.5 w-1.5 rounded-full ${spotlight.active ? "bg-[#2a8b51]" : "bg-[#92938e]"}`} />{spotlight.active ? "Actief" : "Verborgen"}</span><p className="mt-1.5 text-xs text-[#899188]">Volgorde {spotlight.sortOrder}</p></div>
										<div className="flex justify-end gap-1.5">
											<button onClick={() => toggleSpotlight(spotlight)} className="rounded-lg p-2.5 text-[#657269] transition hover:bg-[#e6eee8] hover:text-[#0c4a2c]" aria-label={spotlight.active ? `${spotlight.title} verbergen` : `${spotlight.title} tonen`}>{spotlight.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
											<button onClick={() => setEditing(spotlight)} className="rounded-lg p-2.5 text-[#657269] transition hover:bg-[#e6eee8] hover:text-[#0c4a2c]" aria-label={`${spotlight.title} bewerken`}><Pencil className="h-4 w-4" /></button>
											<button onClick={() => removeSpotlight(spotlight)} className="rounded-lg p-2.5 text-[#657269] transition hover:bg-red-50 hover:text-red-700" aria-label={`${spotlight.title} verwijderen`}><Trash2 className="h-4 w-4" /></button>
										</div>
									</li>
								))}
							</ul>
						)}
					</section>
				</main>
			</AdminShell>

			{editing !== undefined ? <SpotlightEditor spotlight={editing} onClose={() => setEditing(undefined)} onSaved={upsertSpotlight} /> : null}
		</>
	);
}

export async function getServerSideProps(context) {
	const [{ getAdminSession }, { listSpotlights }] = await Promise.all([
		import("@/lib/admin-auth"),
		import("@/lib/spotlights"),
	]);
	const session = await getAdminSession(context.req);

	if (!session) {
		return { redirect: { destination: "/login", permanent: false } };
	}

	const spotlights = await listSpotlights({ includeInactive: true });
	return {
		props: {
			initialSpotlights: JSON.parse(JSON.stringify(spotlights)),
		},
	};
}
