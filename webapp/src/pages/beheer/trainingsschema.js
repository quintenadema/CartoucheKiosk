import Head from "next/head";
import {
	CalendarRange,
	Clock3,
	Eye,
	EyeOff,
	Layers2,
	MapPinned,
	Pencil,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import AdminShell from "@/components/admin-shell";

const DAYS = [
	{ value: 1, label: "Maandag" },
	{ value: 2, label: "Dinsdag" },
	{ value: 3, label: "Woensdag" },
	{ value: 4, label: "Donderdag" },
	{ value: 5, label: "Vrijdag" },
	{ value: 6, label: "Zaterdag" },
	{ value: 7, label: "Zondag" },
];

const FIELDS = [
	"Veld 1",
	"Veld 2",
	"Veld 3",
	"Veld 4",
	"Veld 5",
	"Veld 6",
	"Veld 7",
	"Miniveld 1",
	"Miniveld 2",
];

const EMPTY_FORM = {
	id: null,
	dayOfWeek: 1,
	fieldName: "Veld 1",
	fieldArea: "Volledig",
	title: "",
	startTime: "16:00",
	endTime: "17:00",
	notes: "",
	active: true,
};

function dayLabel(dayOfWeek) {
	return DAYS.find((day) => day.value === dayOfWeek)?.label ?? "Onbekend";
}

function TrainingEditor({ session, onClose, onSaved }) {
	const [form, setForm] = useState({ ...EMPTY_FORM, ...(session ?? {}) });
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

	async function save(event) {
		event.preventDefault();
		setSaving(true);
		setError("");

		try {
			const response = await fetch(
				form.id ? `/api/admin/training-sessions/${form.id}` : "/api/admin/training-sessions",
				{
					method: form.id ? "PUT" : "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(form),
				}
			);
			const body = await response.json();
			if (!response.ok) throw new Error(body.error || "Opslaan is mislukt");

			onSaved(body.session);
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
						<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#9a7914]">Trainingsschema</p>
						<h2 className="mt-2 text-3xl font-semibold text-[#10261a]">
							{form.id ? "Training aanpassen" : "Training toevoegen"}
						</h2>
					</div>
					<button onClick={closeSheet} className="rounded-full border border-[#d9d2c2] p-2.5 text-[#536158] transition hover:bg-white" aria-label="Sluiten">
						<X className="h-5 w-5" />
					</button>
				</div>

				<form className="mt-8 space-y-6" onSubmit={save}>
					<label className="block">
						<span className="mb-2 block text-sm font-semibold text-[#25382b]">Team of omschrijving</span>
						<input
							value={form.title}
							onChange={(event) => setForm({ ...form, title: event.target.value })}
							required
							maxLength={160}
							placeholder="Bijvoorbeeld JO12-1 of Walking Hockey"
							className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
						/>
					</label>

					<div className="grid gap-5 sm:grid-cols-2">
						<label className="block">
							<span className="mb-2 block text-sm font-semibold text-[#25382b]">Dag</span>
							<select
								value={form.dayOfWeek}
								onChange={(event) => setForm({ ...form, dayOfWeek: Number(event.target.value) })}
								className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
							>
								{DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
							</select>
						</label>
						<label className="block">
							<span className="mb-2 block text-sm font-semibold text-[#25382b]">Veld</span>
							<select
								value={form.fieldName}
								onChange={(event) => setForm({ ...form, fieldName: event.target.value })}
								className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
							>
								{FIELDS.map((field) => <option key={field}>{field}</option>)}
							</select>
						</label>
					</div>

					<div className="grid gap-5 sm:grid-cols-3">
						<label className="block">
							<span className="mb-2 block text-sm font-semibold text-[#25382b]">Velddeel</span>
							<select
								value={form.fieldArea}
								onChange={(event) => setForm({ ...form, fieldArea: event.target.value })}
								className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
							>
								<option>Volledig</option>
								<option>A</option>
								<option>B</option>
							</select>
						</label>
						<label className="block">
							<span className="mb-2 block text-sm font-semibold text-[#25382b]">Begintijd</span>
							<input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} required className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10" />
						</label>
						<label className="block">
							<span className="mb-2 block text-sm font-semibold text-[#25382b]">Eindtijd</span>
							<input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} required className="w-full rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10" />
						</label>
					</div>

					<label className="block">
						<span className="mb-2 block text-sm font-semibold text-[#25382b]">Notitie <span className="font-normal text-[#7a867e]">(optioneel)</span></span>
						<textarea
							value={form.notes ?? ""}
							onChange={(event) => setForm({ ...form, notes: event.target.value })}
							rows={3}
							maxLength={500}
							className="w-full resize-none rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 outline-none focus:border-[#0c4a2c] focus:ring-4 focus:ring-[#0c4a2c]/10"
						/>
					</label>

					<label className="flex items-center justify-between rounded-xl border border-[#c8c0ad] bg-white px-4 py-3.5 text-sm font-semibold text-[#25382b]">
						Zichtbaar op de kioskschermen
						<input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-5 w-5 accent-[#0c4a2c]" />
					</label>

					{error ? <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p> : null}

					<div className="flex gap-3 border-t border-[#ded8ca] pt-6">
						<button type="button" onClick={closeSheet} className="flex-1 rounded-xl border border-[#bdb6a5] px-5 py-3.5 font-semibold text-[#34483a] transition hover:bg-white">Annuleren</button>
						<button type="submit" disabled={saving} className="flex-[1.4] rounded-xl bg-[#0c4a2c] px-5 py-3.5 font-semibold text-white transition hover:bg-[#083b22] disabled:cursor-wait disabled:opacity-60">
							{saving ? "Opslaan…" : "Training opslaan"}
						</button>
					</div>
				</form>
			</section>
		</div>
	);
}

export default function TrainingScheduleAdmin({ initialSessions }) {
	const [sessions, setSessions] = useState(initialSessions);
	const [query, setQuery] = useState("");
	const [viewMode, setViewMode] = useState("field");
	const [selectedField, setSelectedField] = useState("all");
	const [selectedDay, setSelectedDay] = useState("all");
	const [editing, setEditing] = useState(undefined);
	const [message, setMessage] = useState("");
	const fieldNames = useMemo(() => {
		const knownFields = new Set(FIELDS);
		const additionalFields = [...new Set(sessions.map((session) => session.fieldName))]
			.filter((fieldName) => !knownFields.has(fieldName))
			.sort((left, right) => left.localeCompare(right, "nl"));
		return [...FIELDS, ...additionalFields];
	}, [sessions]);

	const filteredSessions = useMemo(() => {
		const normalizedQuery = query.trim().toLowerCase();
		return sessions.filter((session) => {
			const matchesField = selectedField === "all" || session.fieldName === selectedField;
			const matchesDay = selectedDay === "all" || session.dayOfWeek === Number(selectedDay);
			const matchesQuery = !normalizedQuery || [session.title, session.fieldName, session.notes, dayLabel(session.dayOfWeek)]
				.filter(Boolean)
				.some((value) => value.toLowerCase().includes(normalizedQuery));
			return matchesField && matchesDay && matchesQuery;
		});
	}, [query, selectedDay, selectedField, sessions]);

	const groupedSessions = useMemo(() => {
		if (viewMode === "field") {
			return fieldNames.map((fieldName) => ({
				key: fieldName,
				label: fieldName,
				sessions: filteredSessions
					.filter((session) => session.fieldName === fieldName)
					.sort((left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime) || left.fieldArea.localeCompare(right.fieldArea)),
			})).filter((field) => field.sessions.length > 0);
		}

		return DAYS.map((day) => ({
			key: String(day.value),
			label: day.label,
			sessions: filteredSessions
				.filter((session) => session.dayOfWeek === day.value)
				.sort((left, right) => left.startTime.localeCompare(right.startTime) || left.fieldName.localeCompare(right.fieldName, "nl") || left.fieldArea.localeCompare(right.fieldArea)),
		})).filter((day) => day.sessions.length > 0);
	}, [fieldNames, filteredSessions, viewMode]);

	function upsertSession(session) {
		setSessions((current) => [...current.filter((item) => item.id !== session.id), session].sort(
			(left, right) => left.dayOfWeek - right.dayOfWeek || left.startTime.localeCompare(right.startTime) || left.fieldName.localeCompare(right.fieldName)
		));
		setMessage("De training is opgeslagen.");
	}

	async function removeSession(session) {
		if (!window.confirm(`Weet je zeker dat je ${session.title} op ${dayLabel(session.dayOfWeek)} wilt verwijderen?`)) return;
		const response = await fetch(`/api/admin/training-sessions/${session.id}`, { method: "DELETE" });
		if (!response.ok) {
			setMessage("Verwijderen is mislukt. Probeer het opnieuw.");
			return;
		}
		setSessions((current) => current.filter((item) => item.id !== session.id));
		setMessage(`${session.title} is verwijderd.`);
	}

	async function toggleSession(session) {
		const response = await fetch(`/api/admin/training-sessions/${session.id}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...session, active: !session.active }),
		});
		const body = await response.json();
		if (response.ok) upsertSession(body.session);
		else setMessage(body.error || "Zichtbaarheid aanpassen is mislukt.");
	}

	return (
		<>
			<Head>
				<title>Trainingsschema | Cartouche Narrowcasting beheer</title>
				<meta name="robots" content="noindex,nofollow" />
			</Head>

			<AdminShell activeItem="training-schedule">
				<main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
					<div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
						<div>
							<p className="text-xs font-bold uppercase tracking-[0.22em] text-[#957512]">Planning 2026–2027</p>
							<h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Trainingsschema</h1>
							<p className="mt-3 max-w-2xl text-[#5c6a61]">Beheer de wekelijkse trainingen die op de veldschermen naast wedstrijden worden getoond.</p>
						</div>
						<button onClick={() => setEditing(null)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0c4a2c] px-5 py-3 font-semibold text-white shadow-lg shadow-[#0c4a2c]/15 transition hover:bg-[#083b22]">
							<Plus className="h-5 w-5" /> Training toevoegen
						</button>
					</div>

					<div className="mt-10 grid gap-4 sm:grid-cols-3">
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><CalendarRange className="h-5 w-5 text-[#0c4a2c]" /><p className="mt-5 text-3xl font-semibold">{sessions.length}</p><p className="mt-1 text-sm text-[#68756d]">Trainingen totaal</p></div>
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Eye className="h-5 w-5 text-[#0c4a2c]" /><p className="mt-5 text-3xl font-semibold">{sessions.filter((session) => session.active).length}</p><p className="mt-1 text-sm text-[#68756d]">Zichtbaar op scherm</p></div>
						<div className="rounded-2xl border border-[#d7d0c0] bg-[#f8f5ed] p-5"><Layers2 className="h-5 w-5 text-[#957512]" /><p className="mt-5 text-3xl font-semibold">{new Set(sessions.map((session) => session.fieldName)).size}</p><p className="mt-1 text-sm text-[#68756d]">Velden in gebruik</p></div>
					</div>

					{message ? <button onClick={() => setMessage("")} className="mt-6 w-full rounded-xl border border-[#b7d0bf] bg-[#e9f4ec] px-4 py-3 text-left text-sm text-[#18522f]">{message}</button> : null}

					<section className="mt-8 overflow-hidden rounded-[1.75rem] border border-[#d3ccbc] bg-[#f8f5ed]">
						<div className="flex flex-col justify-between gap-4 border-b border-[#ddd6c7] p-5 lg:flex-row lg:items-center lg:px-6">
							<div><h2 className="text-xl font-semibold">{viewMode === "field" ? "Veldplanning" : "Weekplanning"}</h2><p className="mt-1 text-sm text-[#6b786f]">{viewMode === "field" ? "Per veld, gesorteerd op dag en begintijd" : "Per dag, gesorteerd op begintijd en veld"}</p></div>
							<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
								<div className="inline-flex rounded-xl border border-[#cec6b5] bg-[#e9e5d9] p-1" role="group" aria-label="Schema groeperen op">
									<button type="button" onClick={() => setViewMode("field")} aria-pressed={viewMode === "field"} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${viewMode === "field" ? "bg-[#0c4a2c] text-white shadow-sm" : "text-[#5f6d64] hover:text-[#0c4a2c]"}`}>Per veld</button>
									<button type="button" onClick={() => setViewMode("day")} aria-pressed={viewMode === "day"} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${viewMode === "day" ? "bg-[#0c4a2c] text-white shadow-sm" : "text-[#5f6d64] hover:text-[#0c4a2c]"}`}>Per dag</button>
								</div>
								<select value={selectedField} onChange={(event) => setSelectedField(event.target.value)} aria-label="Filter op veld" className="rounded-xl border border-[#cec6b5] bg-white px-3.5 py-2.5 text-sm text-[#35483b] outline-none focus:border-[#0c4a2c]">
									<option value="all">Alle velden</option>
									{fieldNames.map((fieldName) => <option key={fieldName} value={fieldName}>{fieldName}</option>)}
								</select>
								<select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} aria-label="Filter op dag" className="rounded-xl border border-[#cec6b5] bg-white px-3.5 py-2.5 text-sm text-[#35483b] outline-none focus:border-[#0c4a2c]">
									<option value="all">Alle dagen</option>
									{DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
								</select>
								<label className="flex items-center gap-2 rounded-xl border border-[#cec6b5] bg-white px-3.5 py-2.5 text-[#66746b] focus-within:border-[#0c4a2c]">
									<Search className="h-4 w-4" /><span className="sr-only">Zoeken</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Zoek team, veld of dag…" className="w-full bg-transparent text-sm text-[#10261a] outline-none sm:w-48" />
								</label>
							</div>
						</div>

						{groupedSessions.length === 0 ? (
							<div className="px-6 py-20 text-center text-[#657269]"><CalendarRange className="mx-auto h-8 w-8" /><p className="mt-3 font-semibold">Geen trainingen gevonden</p></div>
						) : (
							<div className="divide-y divide-[#d9d2c3]">
								{groupedSessions.map((group) => (
									<section key={group.key}>
										<header className="flex items-center justify-between bg-[#e9e5d9] px-5 py-3 sm:px-6">
											<h3 className="flex items-center gap-2 font-semibold">{viewMode === "field" ? <MapPinned className="h-4 w-4 text-[#0c4a2c]" /> : <CalendarRange className="h-4 w-4 text-[#0c4a2c]" />}{group.label}</h3>
											<span className="text-xs font-semibold text-[#718078]">{group.sessions.length} trainingen{viewMode === "field" ? ` · ${new Set(group.sessions.map((session) => session.dayOfWeek)).size} dagen` : ""}</span>
										</header>
										<ul className="divide-y divide-[#e2dccf]">
											{group.sessions.map((session) => (
												<li key={session.id} className="grid items-center gap-4 px-5 py-4 transition hover:bg-white/70 sm:grid-cols-[130px_150px_minmax(0,1fr)_110px_auto] sm:px-6">
													{viewMode === "field" ? (
														<><div className="flex items-center gap-2 font-semibold"><CalendarRange className="h-4 w-4 text-[#0c4a2c]" />{dayLabel(session.dayOfWeek)}</div><div className="min-w-0"><p className="flex items-center gap-2 font-semibold tabular-nums"><Clock3 className="h-4 w-4 text-[#8d721f]" />{session.startTime}–{session.endTime}</p><p className="mt-1 text-xs text-[#7a867e]">{session.fieldArea === "Volledig" ? "Hele veld" : `Helft ${session.fieldArea}`}</p></div></>
													) : (
														<><div className="flex items-center gap-2 font-semibold tabular-nums"><Clock3 className="h-4 w-4 text-[#8d721f]" />{session.startTime}–{session.endTime}</div><div className="min-w-0"><p className="flex items-center gap-2 font-semibold"><MapPinned className="h-4 w-4 text-[#0c4a2c]" />{session.fieldName}</p><p className="mt-1 text-xs text-[#7a867e]">{session.fieldArea === "Volledig" ? "Hele veld" : `Helft ${session.fieldArea}`}</p></div></>
													)}
													<div className="min-w-0"><p className="truncate text-base font-semibold">{session.title}</p>{session.notes ? <p className="mt-1 truncate text-xs text-[#7a867e]">{session.notes}</p> : null}</div>
													<div><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${session.active ? "bg-[#e0f0e4] text-[#196039]" : "bg-[#e7e3d9] text-[#6d706b]"}`}><span className={`h-1.5 w-1.5 rounded-full ${session.active ? "bg-[#2a8b51]" : "bg-[#92938e]"}`} />{session.active ? "Zichtbaar" : "Verborgen"}</span></div>
													<div className="flex justify-end gap-1.5">
														<button onClick={() => toggleSession(session)} className="rounded-lg p-2.5 text-[#657269] transition hover:bg-[#e6eee8] hover:text-[#0c4a2c]" aria-label={session.active ? `${session.title} verbergen` : `${session.title} tonen`}>{session.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
														<button onClick={() => setEditing(session)} className="rounded-lg p-2.5 text-[#657269] transition hover:bg-[#e6eee8] hover:text-[#0c4a2c]" aria-label={`${session.title} bewerken`}><Pencil className="h-4 w-4" /></button>
														<button onClick={() => removeSession(session)} className="rounded-lg p-2.5 text-[#657269] transition hover:bg-red-50 hover:text-red-700" aria-label={`${session.title} verwijderen`}><Trash2 className="h-4 w-4" /></button>
													</div>
												</li>
											))}
										</ul>
									</section>
								))}
							</div>
						)}
					</section>
				</main>
			</AdminShell>

			{editing !== undefined ? <TrainingEditor session={editing} onClose={() => setEditing(undefined)} onSaved={upsertSession} /> : null}
		</>
	);
}

export async function getServerSideProps(context) {
	const [{ getAdminSession }, { listTrainingSessions }] = await Promise.all([
		import("@/lib/admin-auth"),
		import("@/lib/training-sessions"),
	]);
	const session = await getAdminSession(context.req);

	if (!session) {
		return { redirect: { destination: "/login", permanent: false } };
	}

	const sessions = await listTrainingSessions({ includeInactive: true });
	return {
		props: {
			initialSessions: JSON.parse(JSON.stringify(sessions)),
		},
	};
}
