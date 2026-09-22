import { upload } from "@vercel/blob/client";
import Head from "next/head";
import {
	Eye,
	EyeOff,
	ImagePlus,
	LayoutGrid,
	Plus,
	RefreshCw,
	Search,
	Sparkles,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import AdminShell from "@/components/admin-shell";

const emptyForm = {
	id: null,
	name: "",
	websiteUrl: "",
	sortOrder: 0,
	active: true,
	imageUrl: "",
	blobPathname: "",
	featured: false,
	featuredImageUrl: "",
	featuredBlobPathname: "",
};

function SponsorEditor({ sponsor, onClose, onSaved }) {
	const [form, setForm] = useState({ ...emptyForm, ...(sponsor ?? {}) });
	const [file, setFile] = useState(null);
	const [preview, setPreview] = useState(sponsor?.imageUrl ?? "");
	const [featuredFile, setFeaturedFile] = useState(null);
	const [featuredPreview, setFeaturedPreview] = useState(sponsor?.featuredImageUrl ?? "");
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

	function chooseFeaturedFile(event) {
		const selected = event.target.files?.[0];
		if (!selected) return;
		setFeaturedFile(selected);
		setFeaturedPreview(URL.createObjectURL(selected));
	}

	async function save(event) {
		event.preventDefault();
		setSaving(true);
		setError("");

		try {
			let imageUrl = form.imageUrl;
			let blobPathname = form.blobPathname;
			let featuredImageUrl = form.featuredImageUrl;
			let featuredBlobPathname = form.featuredBlobPathname;

			if (file) {
				const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				const blob = await upload(`sponsors/${cleanName}`, file, {
					access: "public",
					handleUploadUrl: "/api/admin/upload",
				});
				imageUrl = blob.url;
				blobPathname = blob.pathname;
			}

			if (featuredFile) {
				const cleanName = featuredFile.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				const blob = await upload(`sponsors/featured/${cleanName}`, featuredFile, {
					access: "public",
					handleUploadUrl: "/api/admin/upload",
				});
				featuredImageUrl = blob.url;
				featuredBlobPathname = blob.pathname;
			}

			const response = await fetch(
				form.id ? `/api/admin/sponsors/${form.id}` : "/api/admin/sponsors",
				{
					method: form.id ? "PUT" : "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...form,
						imageUrl,
						blobPathname,
						featuredImageUrl,
						featuredBlobPathname,
					}),
				}
			);
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Opslaan is mislukt");

			onSaved(body.sponsor);
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
			<section className={`admin-side-sheet relative h-full w-full overflow-y-auto border-l border-black/10 bg-[#f7f4eb] p-6 shadow-[-32px_0_80px_rgba(0,0,0,0.28)] sm:max-w-[640px] sm:p-9 ${closing ? "is-closing" : ""}`} onAnimationEnd={finishClosing}>
				<div className="flex items-start justify-between gap-5">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a7914]">Sponsorbeheer</p>
						<h2 className="mt-2 text-3xl font-semibold text-[#10261a]">{form.id ? "Sponsor aanpassen" : "Sponsor toevoegen"}</h2>
					</div>
					<button onClick={closeSheet} className="rounded-full border border-[#d9d2c2] p-2.5 text-[#536158] transition hover:bg-white" aria-label="Sluiten">
						<X className="h-5 w-5" />
					</button>
				</div>

				<form className="mt-8 space-y-6" onSubmit={save}>
					<div>
						<span className="mb-2 block text-sm font-semibold text-[#25382b]">Sponsorlogo</span>
						<label className="group flex min-h-48 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#c8c0ad] bg-white transition hover:border-[#0c4a2c] hover:bg-[#f2f7f3]">
							{preview ? (
								<img src={preview} alt="Voorvertoning sponsorlogo" className="max-h-40 max-w-[80%] object-contain" />
							) : (
								<div className="text-center text-[#607067]">
									<ImagePlus className="mx-auto h-8 w-8 text-[#0c4a2c]" />
									<p className="mt-3 font-semibold">Kies een logo</p>
									<p className="mt-1 text-xs">PNG, JPG of WebP · maximaal 4 MB</p>
								</div>
							)}
							<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} className="sr-only" required={!form.imageUrl} />
						</label>
					</div>

					<label className="block">
						<span className="mb-2 block text-sm font-semibold text-[#25382b]">Naam</span>
						<input
							value={form.name}
							onChange={(event) => setForm({ ...form, name: event.target.value })}
							required
							maxLength={120}
							className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
						/>
					</label>

					<label className="block">
						<span className="mb-2 block text-sm font-semibold text-[#25382b]">Website <span className="font-normal text-[#7a867e]">(optioneel)</span></span>
						<input
							type="url"
							placeholder="https://sponsor.nl"
							value={form.websiteUrl ?? ""}
							onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })}
							className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
						/>
					</label>

					<div className="grid items-start gap-5 sm:grid-cols-2">
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
						<div className="space-y-3">
							<label className="flex items-center justify-between rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 text-sm font-semibold text-[#25382b]">
								Zichtbaar op scherm
								<input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-5 w-5 accent-[#0c4a2c]" />
							</label>
							<label className="flex items-center justify-between rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 text-sm font-semibold text-[#25382b]">
								<span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#9a7914]" /> Uitgelicht</span>
								<input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} className="h-5 w-5 accent-[#0c4a2c]" />
							</label>
						</div>
					</div>

					{form.featured ? (
						<div className="rounded-2xl border border-[#d8c98f] bg-[#f4ecd3] p-4">
							<div className="mb-3">
								<span className="block text-sm font-semibold text-[#25382b]">Uitgelichte foto</span>
								<p className="mt-1 text-xs leading-relaxed text-[#6f735f]">Deze foto vult het scherm gedurende 10 seconden wanneer de sponsor het midden van de carrousel bereikt.</p>
							</div>
							<label className="group flex min-h-56 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-[#c7b66f] bg-white/70 transition hover:border-[#0c4a2c] hover:bg-white">
								{featuredPreview ? (
									<img src={featuredPreview} alt="Voorvertoning uitgelichte sponsorfoto" className="h-56 w-full object-cover" />
								) : (
									<div className="px-6 text-center text-[#607067]">
										<ImagePlus className="mx-auto h-8 w-8 text-[#9a7914]" />
										<p className="mt-3 font-semibold">Kies een uitgelichte foto</p>
										<p className="mt-1 text-xs">Liggend 16:9 aanbevolen · PNG, JPG of WebP · maximaal 4 MB</p>
									</div>
								)}
								<input
									type="file"
									accept="image/png,image/jpeg,image/webp"
									onChange={chooseFeaturedFile}
									className="sr-only"
									required={!form.featuredImageUrl}
								/>
							</label>
						</div>
					) : null}

					{error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

					<div className="flex gap-3 border-t border-[#ded8ca] pt-6">
						<button type="button" onClick={closeSheet} className="flex-1 rounded-xl border border-[#bdb6a5] px-5 py-3.5 font-semibold text-[#34483a] transition hover:bg-white">Annuleren</button>
						<button type="submit" disabled={saving} className="flex-[1.4] rounded-xl bg-[#0c4a2c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#083b22] disabled:cursor-wait disabled:opacity-60">
							{saving ? "Opslaan…" : "Sponsor opslaan"}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}

function HighlightEditor({ sponsor, onClose, onSaved }) {
	const [file, setFile] = useState(null);
	const [preview, setPreview] = useState(sponsor.featuredImageUrl ?? "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

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
			let featuredImageUrl = sponsor.featuredImageUrl;
			let featuredBlobPathname = sponsor.featuredBlobPathname;

			if (file) {
				const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
				const blob = await upload(`sponsors/featured/${cleanName}`, file, {
					access: "public",
					handleUploadUrl: "/api/admin/upload",
				});
				featuredImageUrl = blob.url;
				featuredBlobPathname = blob.pathname;
			}

			const response = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...sponsor,
					featured: true,
					featuredImageUrl,
					featuredBlobPathname,
				}),
			});
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Uitlichten is mislukt");

			onSaved(body.sponsor);
			onClose();
		} catch (saveError) {
			setError(saveError.message || "Uitlichten is mislukt");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-labelledby="highlight-title">
			<button className="absolute inset-0 cursor-default bg-[#04150d]/65 backdrop-blur-sm" onClick={onClose} aria-label="Sluiten" />
			<section className="relative w-full max-w-2xl rounded-[2rem] border border-black/10 bg-[#f7f4eb] p-6 shadow-[0_32px_90px_rgba(0,0,0,0.35)] sm:p-9">
				<div className="flex items-start justify-between gap-5">
					<div>
						<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a7914]">Highlight instellen</p>
						<h2 id="highlight-title" className="mt-2 text-3xl font-semibold text-[#10261a]">{sponsor.name}</h2>
						<p className="mt-2 text-sm leading-relaxed text-[#657269]">Kies de liggende foto die 10 seconden schermvullend verschijnt wanneer deze sponsor wordt uitgelicht.</p>
					</div>
					<button onClick={onClose} className="rounded-full border border-[#d9d2c2] p-2.5 text-[#536158] transition hover:bg-white" aria-label="Sluiten"><X className="h-5 w-5" /></button>
				</div>

				<form className="mt-6" onSubmit={save}>
					<label className="group flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-[#c7b66f] bg-white transition hover:border-[#0c4a2c]">
						{preview ? (
							<img src={preview} alt="Voorvertoning highlight" className="h-full w-full object-contain" />
						) : (
							<div className="px-6 text-center text-[#607067]"><ImagePlus className="mx-auto h-9 w-9 text-[#9a7914]" /><p className="mt-3 font-semibold">Kies een highlightfoto</p><p className="mt-1 text-xs">Liggend 16:9 aanbevolen · maximaal 4 MB</p></div>
						)}
						<input type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseFile} className="sr-only" required={!sponsor.featuredImageUrl} />
					</label>

					{error ? <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

					<div className="mt-6 flex gap-3 border-t border-[#ded8ca] pt-6">
						<button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#bdb6a5] px-5 py-3.5 font-semibold text-[#34483a] transition hover:bg-white">Annuleren</button>
						<button type="submit" disabled={saving} className="flex-[1.4] rounded-xl bg-[#0c4a2c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#083b22] disabled:cursor-wait disabled:opacity-60">{saving ? "Opslaan…" : "Highlight inschakelen"}</button>
					</div>
				</form>
			</section>
		</div>
	);
}

function formatSyncTime(value) {
	if (!value) return "Nog niet gesynchroniseerd";
	return `Laatst bijgewerkt ${new Intl.DateTimeFormat("nl-NL", {
		dateStyle: "short",
		timeStyle: "short",
		timeZone: "Europe/Amsterdam",
	}).format(new Date(value))}`;
}

export default function AdminPage({ initialSponsors, initialSyncSettings }) {
	const [sponsors, setSponsors] = useState(initialSponsors);
	const [syncSettings, setSyncSettings] = useState(initialSyncSettings);
	const [syncing, setSyncing] = useState(false);
	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState(undefined);
	const [highlighting, setHighlighting] = useState(undefined);
	const [message, setMessage] = useState("");

	const filteredSponsors = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return normalized ? sponsors.filter((sponsor) => sponsor.name.toLowerCase().includes(normalized)) : sponsors;
	}, [query, sponsors]);

	function upsertSponsor(sponsor, nextMessage = "De sponsor is opgeslagen.") {
		setSponsors((current) =>
			[...current.filter((item) => item.id !== sponsor.id), sponsor].sort(
				(left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
			)
		);
		setMessage(nextMessage);
	}

	async function toggleSponsor(sponsor) {
		const response = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...sponsor, active: !sponsor.active }),
		});
		const body = await response.json();
		if (response.ok) upsertSponsor(body.sponsor, `${sponsor.name} is ${sponsor.active ? "verborgen" : "weer zichtbaar"}.`);
		else setMessage(body.error || "Zichtbaarheid aanpassen is mislukt.");
	}

	async function toggleFeatured(sponsor) {
		if (!sponsor.featured && !sponsor.featuredImageUrl) {
			setHighlighting(sponsor);
			return;
		}

		const response = await fetch(`/api/admin/sponsors/${sponsor.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...sponsor, featured: !sponsor.featured }),
		});
		const body = await response.json();
		if (response.ok) {
			upsertSponsor(body.sponsor, `${sponsor.name} wordt ${sponsor.featured ? "niet meer" : "voortaan"} uitgelicht.`);
		} else {
			setMessage(body.error || "Highlight aanpassen is mislukt.");
		}
	}

	async function toggleAutomaticSync() {
		const enabled = !syncSettings.enabled;
		setSyncing(true);
		setMessage("");

		try {
			const response = await fetch("/api/admin/sponsor-sync", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ enabled }),
			});
			const body = await response.json();
			if (body.settings) setSyncSettings(body.settings);
			if (!response.ok) throw new Error(body.error || "Synchronisatie aanpassen is mislukt");
			if (Array.isArray(body.sponsors)) setSponsors(body.sponsors);
			setMessage(enabled
				? "Automatische synchronisatie staat aan. De sponsorlijst is direct bijgewerkt."
				: "Automatische synchronisatie staat uit. De huidige sponsorlijst blijft behouden."
			);
		} catch (syncError) {
			setMessage(syncError.message || "Synchronisatie aanpassen is mislukt.");
		} finally {
			setSyncing(false);
		}
	}

	return (
		<>
			<Head>
				<title>Sponsoren | Cartouche Kioskbeheer</title>
				<meta name="robots" content="noindex,nofollow" />
			</Head>

			<AdminShell activeItem="sponsors">
				<main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
					<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#957512]">Contentbeheer</p>
							<h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Sponsoren</h1>
							<p className="mt-3 max-w-2xl text-[#5c6a61]">Houd de sponsoren gelijk met de clubsite en bepaal wat zichtbaar of uitgelicht is.</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<button
								type="button"
								role="switch"
								aria-checked={syncSettings.enabled}
								onClick={toggleAutomaticSync}
								disabled={syncing}
								className={`inline-flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-sm transition disabled:cursor-wait disabled:opacity-65 ${syncSettings.enabled ? "border-[#9fc4aa] bg-[#e6f2e9] text-[#155b34]" : "border-[#c9c1b1] bg-[#f8f5ed] text-[#536158] hover:bg-white"}`}
							>
								<RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
								<span className="text-left"><span className="block">Sync met clubsite</span><span className="mt-0.5 block text-[10px] font-bold uppercase tracking-[0.12em] opacity-60">{syncing ? "Bezig met bijwerken" : syncSettings.enabled ? "Elke 12 uur aan" : "Uitgeschakeld"}</span></span>
								<span className={`relative h-6 w-11 rounded-full transition ${syncSettings.enabled ? "bg-[#257548]" : "bg-[#b8b5ac]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${syncSettings.enabled ? "translate-x-6" : "translate-x-1"}`} /></span>
							</button>
							<button onClick={() => setEditing(null)} className="inline-flex items-center gap-2 rounded-xl bg-[#0c4a2c] px-5 py-3 font-semibold text-white shadow-lg shadow-[#0c4a2c]/15 transition hover:bg-[#083b22]"><Plus className="h-5 w-5" /> Sponsor toevoegen</button>
						</div>
					</div>

					<div className="mt-10 grid gap-4 sm:grid-cols-3">
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><LayoutGrid className="h-5 w-5 text-[#0c4a2c]" /><p className="mt-5 text-3xl font-semibold">{sponsors.length}</p><p className="mt-1 text-sm text-[#68756d]">Sponsoren totaal</p></div>
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Eye className="h-5 w-5 text-[#0c4a2c]" /><p className="mt-5 text-3xl font-semibold">{sponsors.filter((sponsor) => sponsor.active).length}</p><p className="mt-1 text-sm text-[#68756d]">Zichtbaar op scherm</p></div>
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Sparkles className="h-5 w-5 text-[#957512]" /><p className="mt-5 text-3xl font-semibold">{sponsors.filter((sponsor) => sponsor.featured).length}</p><p className="mt-1 text-sm text-[#68756d]">Uitgelichte sponsoren</p></div>
					</div>

					<p className="mt-3 text-right text-xs text-[#778179]">{syncSettings.enabled ? `${formatSyncTime(syncSettings.lastSuccessAt)} · bron: hc-cartouche.nl` : "Automatische synchronisatie staat uit"}</p>

					{message ? <button onClick={() => setMessage("")} className="mt-6 w-full rounded-xl border border-[#b7d0bf] bg-[#e9f4ec] px-4 py-3 text-left text-sm text-[#18522f]">{message}</button> : null}

					<section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#d3ccbc] bg-[#f8f5ed]">
						<div className="flex flex-col justify-between gap-4 border-b border-[#ddd6c7] p-5 sm:flex-row sm:items-center sm:px-6">
							<div><h2 className="text-xl font-semibold">Alle sponsoren</h2><p className="mt-1 text-sm text-[#6b786f]">In de volgorde van de clubsite</p></div>
							<label className="flex items-center gap-2 rounded-xl border border-[#cec6b5] bg-white px-3.5 py-2.5 text-[#66746b] focus-within:border-[#0c4a2c]">
								<Search className="h-4 w-4" /><span className="sr-only">Zoeken</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek sponsor…" className="w-full bg-transparent text-sm text-[#10261a] outline-none sm:w-56" />
							</label>
						</div>

						{filteredSponsors.length === 0 ? (
							<div className="px-6 py-20 text-center text-[#657269]"><ImagePlus className="mx-auto h-8 w-8" /><p className="mt-3 font-semibold">Geen sponsoren gevonden</p></div>
						) : (
							<ul className="divide-y divide-[#e0dacc]">
								{filteredSponsors.map((sponsor) => (
									<li key={sponsor.id} className="grid items-center gap-4 px-5 py-4 transition hover:bg-white/70 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:px-6">
										<div className="flex h-16 w-[72px] items-center justify-center rounded-xl border border-[#ded7c9] bg-white p-2"><img src={sponsor.imageUrl} alt={sponsor.name} className="max-h-full max-w-full object-contain" /></div>
										<div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><p className="truncate text-lg font-semibold">{sponsor.name}</p>{sponsor.featured ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f2e5b8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#765b08]"><Sparkles className="h-3 w-3" /> Uitgelicht</span> : null}{!sponsor.active ? <span className="inline-flex shrink-0 rounded-full bg-[#e7e3d9] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6d706b]">Verborgen</span> : null}</div><p className="mt-1 truncate text-sm text-[#788279]">{sponsor.websiteUrl || "Geen website ingesteld"}</p></div>
										<div className="flex justify-end gap-2">
											<button onClick={() => toggleSponsor(sponsor)} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${sponsor.active ? "border-[#b8d2c0] bg-[#e6f2e9] text-[#17613a] hover:bg-[#d8eadc]" : "border-[#d3cec2] bg-[#ece9e1] text-[#777a75] hover:bg-[#e2ded4]"}`} aria-label={sponsor.active ? `${sponsor.name} verbergen` : `${sponsor.name} tonen`} title={sponsor.active ? "Verbergen" : "Tonen"}>{sponsor.active ? <Eye className="h-[18px] w-[18px]" /> : <EyeOff className="h-[18px] w-[18px]" />}</button>
											<button onClick={() => toggleFeatured(sponsor)} className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition ${sponsor.featured ? "border-[#d8c98f] bg-[#f4e8bd] text-[#80630b] hover:bg-[#ecdda4]" : "border-[#d3cec2] bg-white text-[#777a75] hover:border-[#d8c98f] hover:bg-[#f8f1da] hover:text-[#80630b]"}`} aria-label={sponsor.featured ? `${sponsor.name} niet meer uitlichten` : `${sponsor.name} uitlichten`} title={sponsor.featured ? "Highlight uitschakelen" : "Highlight inschakelen"}><Sparkles className="h-[18px] w-[18px]" /></button>
										</div>
									</li>
								))}
							</ul>
						)}
					</section>
				</main>
			</AdminShell>

			{editing !== undefined ? <SponsorEditor sponsor={editing} onClose={() => setEditing(undefined)} onSaved={upsertSponsor} /> : null}
			{highlighting ? <HighlightEditor sponsor={highlighting} onClose={() => setHighlighting(undefined)} onSaved={(sponsor) => upsertSponsor(sponsor, `${sponsor.name} wordt voortaan uitgelicht.`)} /> : null}
		</>
	);
}

export function getServerSideProps() {
	return { redirect: { destination: "/beheer/sponsoren", permanent: false } };
}
