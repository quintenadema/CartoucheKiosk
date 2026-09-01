import Head from "next/head";
import Image from "next/image";
import { format, isSameDay, isToday, setDefaultOptions } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarDays, CircleOff, Newspaper } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
	DebugControls,
	isActionableLiveEvent,
	LIVE_EVENT_DURATION_MS,
	LIVE_POLL_INTERVAL_MS,
	LiveEventTakeover,
	LiveMatchHistory,
	sortActionsChronologically,
} from "@/components/outdoor-live";

setDefaultOptions({ locale: nl });

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const REFRESH_INTERVAL_MS = 120000;
const CLOCK_INTERVAL_MS = 30000;
const LIVE_WINDOW_MS = 110 * 60 * 1000;
const FEATURED_SPONSOR_DURATION_MS = 10_000;
const FEATURED_SPONSOR_EXIT_MS = 900;
const SPONSOR_CAROUSEL_SPEED_MULTIPLIER = 2;
const DEMO_FORCE_LIVE = false;
const LIVE_SEEN_STORAGE_PREFIX = "cartouche-outdoor-live-seen:";

const FIELD_LAYOUT = [
	{
		name: "Veld 2",
		number: "2",
		rotation: "vertical",
		aliases: ["veld 2", "kunstgrasveld 2", "kunstgras veld 2"],
		spotLabel: "",
	},
	{
		name: "LG veld",
		number: "7",
		rotation: "horizontal",
		aliases: ["lg", "lg veld", "veld 7", "kunstgrasveld 7", "kunstgras veld 7"],
		spotLabel: "",
	},
	{
		name: "Veld 5",
		number: "5",
		rotation: "vertical",
		aliases: ["veld 5", "kunstgrasveld 5", "kunstgras veld 5"],
		spotLabel: "",
	},
	{
		name: "Rabobank veld",
		number: "1",
		rotation: "vertical",
		aliases: ["veld 1", "rabobank", "rabobank veld"],
		spotLabel: "Hoofdveld",
	},
	{
		name: "Jumbo Koornneef veld",
		number: "3",
		rotation: "vertical",
		aliases: ["veld 3", "jumbo koornneef", "jumbo koornneef veld", "jumbo koomneef"],
		spotLabel: "",
	},
	{
		name: "Veld 6",
		number: "6",
		rotation: "horizontal",
		aliases: ["mini", "veld 6", "kunstgrasveld 6", "kunstgras veld 6"],
		spotLabel: "Jeugd",
	},
	{
		name: "SK Bouw veld",
		number: "4",
		rotation: "vertical",
		aliases: ["veld 4", "sk bouw", "sk bouw veld"],
		spotLabel: "",
	},
];

function normalizeText(value) {
	return String(value ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

function makeDemoMatch(teamCode) {
	const isDames = teamCode === "D1";
	const now = new Date();

	return {
		id: `demo-${teamCode}-${now.getTime()}`,
		datetime: now.toISOString(),
		field: "Rabobank",
		competition: isDames ? "Overgangsklasse Dames" : "Promotieklasse Heren",
		status: "live",
		home_score: 0,
		away_score: 0,
		home_team: {
			id: isDames ? 268 : 2722,
			name: `Cartouche ${teamCode}`,
			short_name: teamCode,
			club_name: `Cartouche ${teamCode}`,
			logo: "/cartouche.png",
		},
		away_team: {
			id: 999999,
			name: isDames ? "Schaerweijde D1" : "Victoria H1",
			short_name: isDames ? "SCH D1" : "VIC H1",
			club_name: isDames ? "Schaerweijde D1" : "Victoria H1",
			logo: null,
		},
		team_label: isDames ? "Dames 1" : "Heren 1",
		actions: [
			{
				id: `demo-start-${now.getTime()}`,
				action: "match",
				action_type: "start",
				side: "both",
				person_name: null,
				seconds_since_start: 0,
			},
		],
	};
}

function formatDateLabel(value) {
	const date = new Date(value);
	const formatted = isToday(date)
		? format(date, "HH:mm")
		: format(date, "EEE d MMM • HH:mm");

	return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getMatchState(match, now = new Date()) {
	const start = new Date(match.datetime);
	const end = match.end_datetime
		? new Date(match.end_datetime)
		: new Date(start.getTime() + LIVE_WINDOW_MS);

	if (match.status === "final" || now > end) {
		return "finished";
	}

	if (now >= start && now <= end) {
		return "live";
	}

	return "upcoming";
}

function materializeTodaysTrainings(sessions, now = new Date()) {
	const isoDay = now.getDay() === 0 ? 7 : now.getDay();
	const dateKey = format(now, "yyyy-MM-dd");

	return sessions
		.filter((session) => {
			const validFrom = String(session.validFrom ?? "").slice(0, 10);
			const validUntil = String(session.validUntil ?? "").slice(0, 10);
			return session.active !== false && session.dayOfWeek === isoDay &&
				(!validFrom || validFrom <= dateKey) && (!validUntil || validUntil >= dateKey);
		})
		.map((session) => {
			const [startHour, startMinute] = session.startTime.split(":").map(Number);
			const [endHour, endMinute] = session.endTime.split(":").map(Number);
			const start = new Date(now);
			const end = new Date(now);
			start.setHours(startHour, startMinute, 0, 0);
			end.setHours(endHour, endMinute, 0, 0);

			return {
				id: `training-${session.id}-${dateKey}`,
				type: "training",
				datetime: start.toISOString(),
				end_datetime: end.toISOString(),
				field: session.fieldName,
				field_area: session.fieldArea,
				competition: session.fieldArea === "Volledig" ? "Training" : `Training · helft ${session.fieldArea}`,
				home_team: {
					name: session.title,
					club_name: session.title,
					logo: "/cartouche.png",
				},
				away_team: null,
				notes: session.notes,
			};
		});
}

function matchesField(fieldConfig, rawFieldName) {
	const normalized = normalizeText(rawFieldName);

	if (!normalized) {
		return false;
	}
	if (normalized.startsWith("miniveld")) {
		return fieldConfig.aliases.some((alias) => normalized === normalizeText(alias));
	}

	return fieldConfig.aliases.some((alias) => normalized.includes(normalizeText(alias)));
}

function pickFieldMatches(matches, fieldConfig) {
	const now = new Date();
	const sortedMatches = matches
		.filter((match) => matchesField(fieldConfig, match.field))
		.sort((left, right) => new Date(left.datetime) - new Date(right.datetime));

	const currentMatches = [];
	const upcomingMatches = [];

	for (const match of sortedMatches) {
		const state = getMatchState(match, now);

		if (state === "live") {
			currentMatches.push(match);
			continue;
		}

		if (state === "upcoming") {
			if (DEMO_FORCE_LIVE && currentMatches.length === 0) {
				currentMatches.push(match);
				continue;
			}
			upcomingMatches.push(match);
		}
	}

	return {
		currentMatches,
		upcomingMatches,
		allMatches: sortedMatches,
	};
}

function KioskStage({ children }) {
	const [scale, setScale] = useState(1);

	useEffect(() => {
		const updateScale = () => {
			setScale(
				Math.min(
					window.innerWidth / DESIGN_WIDTH,
					window.innerHeight / DESIGN_HEIGHT
				)
			);
		};

		updateScale();
		window.addEventListener("resize", updateScale);

		return () => window.removeEventListener("resize", updateScale);
	}, []);

	return (
		<div className="h-screen w-screen overflow-hidden bg-[linear-gradient(180deg,#071a12_0%,#0b291b_34%,#102f1f_100%)]">
			<div className="flex h-full w-full items-center justify-center">
				<div
					className="shrink-0 overflow-hidden"
					style={{
						width: DESIGN_WIDTH,
						height: DESIGN_HEIGHT,
						transform: `scale(${scale})`,
						transformOrigin: "center center",
					}}
				>
					{children}
				</div>
			</div>
		</div>
	);
}

function GameCard({ label, match, compact = false, secondary = false }) {
	const verticalPadding = compact || secondary ? "py-1.5" : "py-2";
	const containerClassName = `rounded-lg bg-white px-3 ${verticalPadding} text-[#132317] shadow-md`;

	if (!match) {
		return (
			<div className="flex h-full min-h-[88px] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.07] px-4 py-5 text-center text-white">
				<div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/75">
					<CircleOff className="h-5 w-5" />
				</div>
				<p className={`${compact ? "text-[15px]" : "text-[18px]"} mt-3 font-semibold leading-none`}>Geen planning</p>
				<p className={`${compact ? "text-[10px]" : "text-[12px]"} mt-2 text-white/60`}>Dit veld is vrij voor vandaag!</p>
			</div>
		);
	}

	const timeText = isToday(new Date(match.datetime))
		? format(new Date(match.datetime), "HH:mm")
		: formatDateLabel(match.datetime);
	const isTraining = match.type === "training";
	const isLiveMatch = getMatchState(match) === "live" || (DEMO_FORCE_LIVE && !secondary);
	const metaClassName = compact ? "text-[9px]" : secondary ? "text-[9px]" : "text-[10px]";
	const teamClassName = compact ? "text-[13px] leading-5" : secondary ? "text-[18px] leading-6" : "text-[22px] leading-7";
	const scoreClassName = compact ? "min-w-[38px] text-[13px]" : secondary ? "min-w-[42px] text-[14px]" : "min-w-[46px] text-[16px]";
	const logoClassName = compact ? "h-5 w-5" : secondary ? "h-5 w-5" : "h-6 w-6";
	const labelClassName = compact ? "text-[9px]" : secondary ? "text-[9px]" : "text-[10px]";
	const timeClassName = compact ? "text-[12px]" : secondary ? "text-[14px]" : "text-[16px]";
	const bodySpacingClassName = compact || secondary ? "min-w-0 flex-1 space-y-1" : "min-w-0 flex-1 space-y-1.5";
	const endTimeText = match.end_datetime ? format(new Date(match.end_datetime), "HH:mm") : null;

	if (isTraining) {
		const fieldAreaText = match.field_area === "Volledig" ? "Hele veld" : `Helft ${match.field_area}`;
		const trainingTimeText = isLiveMatch
			? endTimeText ? `tot ${endTimeText}` : timeText
			: endTimeText ? `${timeText} tot ${endTimeText}` : timeText;

		return (
			<div className="rounded-lg bg-white px-3 py-1.5 text-[#132317] shadow-md">
				<div className="flex min-w-0 items-center gap-2.5">
					<img src="/cartouche.png" alt="Cartouche" className="h-5 w-5 object-contain" />
					<span className={`${compact ? "text-[12px]" : "text-[16px]"} min-w-0 flex-1 truncate font-semibold leading-5`}>{match.home_team.name}</span>
					<span className={`${compact ? "text-[10px]" : "text-[12px]"} max-w-[44%] shrink-0 truncate font-bold text-[#5d7063]`}>{trainingTimeText} · {fieldAreaText}</span>
					<span className={`${compact ? "text-[9px]" : "text-[11px]"} inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 font-bold uppercase tracking-wider ${isLiveMatch ? "bg-[#0c7444] text-white" : "bg-[#e4ece6] text-[#315c40]"}`}>
						{isLiveMatch ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> : null}
						{isLiveMatch ? "Bezig" : label}
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className={containerClassName}>
			<div className={`${compact ? "mb-1" : "mb-1.5"} flex items-center justify-between gap-3`}>
				<div className="flex items-center gap-2">
					{isLiveMatch ? (
						<span className={`${labelClassName} inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 font-bold uppercase tracking-wider text-white`}>
							<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
							Live
						</span>
					) : (
						<span className={`${labelClassName} font-semibold uppercase tracking-[0.22em] text-[#56715f]`}>
							{label}
						</span>
					)}
					{!isLiveMatch && (
						<span className={`${timeClassName} font-semibold`}>
							{timeText}
						</span>
					)}
				</div>
				<div className={`text-right text-[#6e7f74] ${metaClassName}`}>
					{match.competition}
				</div>
			</div>

			<div className={bodySpacingClassName}>
					<div className="flex items-center gap-2">
						{match.home_team.logo ? (
							<img
								src={match.home_team.logo}
								alt={match.home_team.club_name}
								className={`${logoClassName} object-contain`}
							/>
						) : null}
						<span className={`min-w-0 flex-1 truncate font-medium ${teamClassName}`}>
							{match.home_team.name}
						</span>
						{isLiveMatch && (
							<span className={`shrink-0 text-right font-semibold text-[#132317] ${scoreClassName}`}>
								{match.home_score ?? "-"}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2">
						{match.away_team.logo ? (
							<img
								src={match.away_team.logo}
								alt={match.away_team.club_name}
								className={`${logoClassName} object-contain`}
							/>
						) : null}
						<span className={`min-w-0 flex-1 truncate font-medium ${teamClassName}`}>
							{match.away_team.name}
						</span>
						{isLiveMatch && (
							<span className={`shrink-0 text-right font-semibold text-[#132317] ${scoreClassName}`}>
								{match.away_score ?? "-"}
							</span>
						)}
					</div>
				</div>
		</div>
	);
}

function PitchLines({ rotation }) {
	if (rotation === "horizontal") {
		return (
			<>
				<div className="absolute left-1/4 top-0 h-full w-[2px] -translate-x-1/2 bg-white/[0.65]" />
				<div className="absolute left-1/2 top-0 h-full w-[2px] -translate-x-1/2 bg-white/[0.65]" />
				<div className="absolute left-3/4 top-0 h-full w-[2px] -translate-x-1/2 bg-white/[0.65]" />
				<div className="absolute left-1/2 top-1/2 h-[18%] w-[13.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
				<div className="absolute left-0 top-1/2 h-[28%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
				<div className="absolute left-full top-1/2 h-[28%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
			</>
		);
	}

	return (
		<>
			<div className="absolute left-0 top-1/4 h-[2px] w-full -translate-y-1/2 bg-white/[0.65]" />
			<div className="absolute left-0 top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/[0.65]" />
			<div className="absolute left-0 top-3/4 h-[2px] w-full -translate-y-1/2 bg-white/[0.65]" />
			<div className="absolute left-1/2 top-1/2 h-[13.5%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
			<div className="absolute left-1/2 top-0 h-[16%] w-[35%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
			<div className="absolute left-1/2 top-full h-[16%] w-[35%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white/70" />
		</>
	);
}

function FieldCard({ fieldConfig, matches }) {
	const { currentMatches, upcomingMatches } = pickFieldMatches(matches, fieldConfig);
	const compact = fieldConfig.rotation === "horizontal";
	const listRef = useRef(null);
	const [visibleCardCount, setVisibleCardCount] = useState(2);
	const cards = (currentMatches.length > 0
		? [
			...currentMatches.map((match) => ({ match, label: "Nu bezig" })),
			...upcomingMatches.map((match) => ({
				match,
				label: isSameDay(new Date(currentMatches[0].datetime), new Date(match.datetime)) ? "Hierna" : "Later",
			})),
		]
		: upcomingMatches.map((match, index) => ({
			match,
			label: index === 0
				? "Volgende"
				: new Date(upcomingMatches[0].datetime).getTime() === new Date(match.datetime).getTime()
					? "Volgende"
					: isSameDay(new Date(upcomingMatches[0].datetime), new Date(match.datetime))
						? "Daarna"
						: "Later",
		}))).slice(0, 8);
	const cardLayoutKey = cards.map((card) => `${card.match.id}:${card.label}`).join("|");

	useEffect(() => {
		const list = listRef.current;
		if (!list || cards.length === 0) return undefined;

		const calculateVisibleCards = () => {
			const availableHeight = list.clientHeight;
			const gap = Number.parseFloat(window.getComputedStyle(list).rowGap) || 0;
			let usedHeight = 0;
			let count = 0;

			for (const child of list.children) {
				const nextHeight = usedHeight + (count > 0 ? gap : 0) + child.offsetHeight;
				if (nextHeight > availableHeight + 0.5) break;
				usedHeight = nextHeight;
				count += 1;
			}

			const nextCount = Math.max(1, count);
			setVisibleCardCount((current) => current === nextCount ? current : nextCount);
		};

		const frame = window.requestAnimationFrame(calculateVisibleCards);
		const observer = new ResizeObserver(calculateVisibleCards);
		observer.observe(list);

		return () => {
			window.cancelAnimationFrame(frame);
			observer.disconnect();
		};
	}, [cardLayoutKey, cards.length]);

	return (
		<section className="relative h-full min-h-0 overflow-hidden rounded-[20px] border border-white/10 bg-[#0d5d38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.26)]">
			{/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.08),_transparent_32%)]" /> */}
			{/* <PitchLines rotation={fieldConfig.rotation} /> */}

			<div className="relative z-10 flex h-full flex-col px-3 py-2 text-white">
				<div className="flex items-center justify-between">
					<div className={`${compact ? "text-[18px]" : "text-[22px]"} font-semibold leading-none`}>
						{fieldConfig.name}
					</div>
					<div className={`${compact ? "text-[18px]" : "text-[22px]"} font-semibold leading-none`}>
						{fieldConfig.number}
					</div>
				</div>
				{/* <div className="flex items-start justify-between gap-2">
					<div>
						<div className={`${compact ? "text-[18px]" : "text-[22px]"} font-semibold leading-none`}>
							{fieldConfig.name}
						</div>
						<div className="mt-1 text-[9px] uppercase tracking-[0.28em] text-white/[0.68]">
							{fieldConfig.spotLabel}
						</div>
					</div>

					<div className="rounded-full border border-white/[0.15] bg-black/[0.18] px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-white/[0.72]">
						{statusLabel}
					</div>
				</div> */}

				<div ref={listRef} className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
					{cards.length > 0 ? cards.map((card, index) => (
						<div key={card.match.id} aria-hidden={index >= visibleCardCount} className={`shrink-0 ${index < visibleCardCount ? "" : "invisible"}`}>
							<GameCard
								label={card.label}
								match={card.match}
								compact={compact}
								secondary={index > 0}
							/>
						</div>
					)) : <GameCard label="Volgende" match={null} compact={compact} />}
				</div>
			</div>
		</section>
	);
}

function UtilityCard({ title, muted = false }) {
	return (
		<section
			className={`h-full rounded-[20px] border px-4 py-3 ${
				muted
					? "border-white/[0.08] bg-[#132a20] text-white/[0.84]"
					: "border-[#c8b590]/30 bg-[#f0e0bc] text-[#132317]"
			}`}
		>
			<h2 className="flex h-full items-center justify-center text-[34px] font-semibold leading-none">{title}</h2>
		</section>
	);
}

function SponsorStrip({ sponsors, onFeaturedSponsor, paused = false }) {
	const railRef = useRef(null);
	const lastTriggeredRef = useRef(new Map());
	const duration = Math.max(sponsors.length * 8, 48) / SPONSOR_CAROUSEL_SPEED_MULTIPLIER;

	useEffect(() => {
		if (paused || sponsors.length === 0 || !onFeaturedSponsor) return undefined;

		const checkCenteredSponsor = () => {
			const rail = railRef.current;
			if (!rail) return;

			const featuredCards = rail.querySelectorAll("[data-featured-sponsor]");
			let centeredCard = null;
			let closestDistance = Number.POSITIVE_INFINITY;

			for (const card of featuredCards) {
				const rect = card.getBoundingClientRect();
				const distance = Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2);
				if (distance < closestDistance) {
					closestDistance = distance;
					centeredCard = card;
				}
			}

			if (!centeredCard || closestDistance > 12) return;

			const sponsorId = centeredCard.dataset.featuredSponsor;
			const sponsor = sponsors.find((item) => item.id === sponsorId);
			if (!sponsor?.featured || !sponsor.featuredImageUrl) return;

			const now = Date.now();
			const cooldown = Math.max(duration * 800, 30_000);
			if (now - (lastTriggeredRef.current.get(sponsor.id) ?? 0) < cooldown) return;

			lastTriggeredRef.current.set(sponsor.id, now);
			onFeaturedSponsor(sponsor);
		};

		const detectionInterval = window.setInterval(checkCenteredSponsor, 100);
		return () => window.clearInterval(detectionInterval);
	}, [duration, onFeaturedSponsor, paused, sponsors]);

	if (sponsors.length === 0) {
		return (
			<aside className="grid h-full grid-cols-[190px_minmax(0,1fr)] overflow-hidden rounded-[24px] border border-white/[0.09] bg-white/[0.035]">
				<div className="flex items-center border-r border-white/[0.08] px-7">
					<div>
						<p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#e1b943]">Onze</p>
						<p className="mt-1 text-[24px] font-semibold leading-none text-white">Sponsors</p>
					</div>
				</div>
				<div className="flex items-center justify-center text-[11px] font-semibold uppercase tracking-[0.3em] text-white/25">
					Sponsorcarrousel
				</div>
			</aside>
		);
	}

	return (
		<aside
			aria-label="Sponsoren van HC Cartouche"
			className="grid h-full grid-cols-[190px_minmax(0,1fr)] overflow-hidden rounded-[24px] border border-white/[0.09] bg-[linear-gradient(110deg,rgba(255,255,255,0.07),rgba(255,255,255,0.025))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
		>
			<div className="relative z-10 flex items-center border-r border-white/[0.08] bg-[#0c281a]/80 px-7">
				<div>
					<p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-[#e1b943]">Onze</p>
					<p className="mt-1 text-[24px] font-semibold leading-none text-white">Sponsors</p>
				</div>
			</div>

			<div
				ref={railRef}
				className="relative flex min-w-0 items-center overflow-hidden px-4"
				style={{
					maskImage: "linear-gradient(to right, transparent 0, black 4%, black 96%, transparent 100%)",
					WebkitMaskImage: "linear-gradient(to right, transparent 0, black 4%, black 96%, transparent 100%)",
				}}
			>
				<div
					className={`flex w-max will-change-transform ${paused ? "sponsor-track-paused" : ""}`}
					style={{ animation: `outdoor-sponsors-left ${duration}s linear infinite` }}
				>
					{[0, 1].map((copy) => (
						<div key={copy} className="flex shrink-0 gap-4 pr-4" aria-hidden={copy === 1}>
							{sponsors.map((sponsor) => (
								<div
									key={`${copy}-${sponsor.id}`}
									data-featured-sponsor={sponsor.featured && sponsor.featuredImageUrl ? sponsor.id : undefined}
									className="flex h-[116px] w-[220px] shrink-0 items-center justify-center rounded-[17px] border border-[#dfe5dd] bg-white p-2 shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
								>
									<img
										src={sponsor.image}
										alt={sponsor.name}
										className="h-full w-full object-contain"
										decoding="async"
									/>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</aside>
	);
}

function FeaturedSponsorTakeover({ sponsor, exiting, onExitComplete }) {
	const phaseClassName = exiting ? "is-exiting" : "is-entering";

	const handleAnimationEnd = (event) => {
		if (
			exiting &&
			event.currentTarget === event.target &&
			event.animationName === "featured-takeover-out"
		) {
			onExitComplete();
		}
	};

	return (
		<div
			className="pointer-events-none absolute inset-0 z-50"
			role="status"
			aria-live="polite"
			style={{ "--featured-sponsor-exit-duration": `${FEATURED_SPONSOR_EXIT_MS}ms` }}
		>
			<div
				className={`featured-takeover-backdrop absolute inset-0 ${phaseClassName}`}
			/>
			<article
				className={`featured-takeover-card absolute inset-[42px] overflow-hidden border border-white/15 bg-[#07170f] shadow-[0_44px_120px_rgba(0,0,0,0.7)] ${phaseClassName}`}
				onAnimationEnd={handleAnimationEnd}
			>
				<img
					src={sponsor.featuredImageUrl}
					alt={`Uitgelichte foto van ${sponsor.name}`}
					className="absolute inset-0 h-full w-full object-contain"
				/>
			</article>
		</div>
	);
}

function formatClubContentDate(value, pattern = "d MMM") {
	const [day, month, year] = String(value ?? "").split("-").map(Number);
	if (!day || !month || !year) return "";
	return format(new Date(year, month - 1, day), pattern);
}

function ClubNewsPanel({ items }) {
	const visibleItems = items.slice(0, 3);

	return (
		<section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-white/[0.09] bg-[linear-gradient(145deg,#164a31_0%,#0b2d1d_100%)] p-5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.2)]">
			<div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
			<div className="absolute -right-7 -top-7 h-36 w-36 rounded-full border border-white/10" />

			<div className="relative flex items-center justify-between gap-4">
				<h2 className="text-[30px] font-semibold leading-none">Nieuws</h2>
				<div className="flex h-10 w-10 items-center justify-center rounded-[15px] border border-white/10 bg-white/[0.07]">
					<Newspaper className="h-5 w-5" strokeWidth={1.8} />
				</div>
			</div>

			{visibleItems.length > 0 ? (
				<div className="relative mt-4 grid min-h-0 flex-1 grid-rows-3 gap-2.5">
					{visibleItems.map((item) => (
						<article
							key={item.id}
							className="grid min-h-0 grid-cols-[92px_minmax(0,1fr)] overflow-hidden rounded-[16px] border border-white/10 bg-black/15"
						>
							<div className="overflow-hidden bg-white/[0.06]">
								{item.image ? (
									<img
										src={item.image}
										alt=""
										className="h-full w-full object-cover"
										decoding="async"
									/>
								) : (
									<div className="flex h-full items-center justify-center">
										<Newspaper className="h-6 w-6 text-white/25" strokeWidth={1.6} />
									</div>
								)}
							</div>
							<div className="flex min-w-0 flex-col justify-center px-3 py-2">
								<p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#e5bd45]">
									{formatClubContentDate(item.date, "d MMMM")}
								</p>
								<h3 className="mt-1 line-clamp-2 text-[17px] font-bold leading-[1.18] text-white/95">
									{item.title}
								</h3>
							</div>
						</article>
					))}
				</div>
			) : (
				<div className="relative mt-4 flex min-h-0 flex-1 items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-black/10 px-6 text-center text-[13px] font-semibold text-white/45">
					Geen nieuws beschikbaar
				</div>
			)}
		</section>
	);
}

function ClubAgendaPanel({ items }) {
	const visibleItems = items.slice(0, 3);

	return (
		<section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#d9c69b]/30 bg-[linear-gradient(145deg,#f1dfb8_0%,#dfc17e_100%)] p-5 text-[#173120] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.2)]">
			<div className="absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[#173120]/10" />
			<div className="absolute -right-7 -top-7 h-36 w-36 rounded-full border border-[#173120]/10" />

			<div className="relative flex items-center justify-between gap-4">
				<h2 className="text-[28px] font-semibold leading-none">Agenda</h2>
				<div className="flex h-10 w-10 items-center justify-center rounded-[15px] border border-[#173120]/10 bg-white/30">
					<CalendarDays className="h-5 w-5" strokeWidth={1.8} />
				</div>
			</div>

			{visibleItems.length > 0 ? (
				<ol className="relative mt-3 flex min-h-0 flex-1 flex-col gap-2">
					{visibleItems.map((item) => (
						<li
							key={item.id}
							className="grid min-h-0 flex-1 grid-cols-[54px_minmax(0,1fr)] items-center rounded-[14px] border border-[#173120]/10 bg-white/25 px-2.5 py-1.5"
						>
							<time className="border-r border-[#173120]/10 pr-2 text-center">
								<span className="block text-[17px] font-black leading-none">
									{formatClubContentDate(item.date, "d")}
								</span>
								<span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-[#173120]/60">
									{formatClubContentDate(item.date, "MMM")}
								</span>
							</time>
							<div className="min-w-0 pl-3">
								<p className="truncate text-[15px] font-bold leading-tight">{item.title}</p>
								{item.time ? (
									<p className="mt-1 text-[12px] font-bold text-[#173120]/60">{item.time} uur</p>
								) : null}
							</div>
						</li>
					))}
				</ol>
			) : (
				<div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center rounded-[16px] border border-dashed border-[#173120]/15 bg-white/10 px-6 text-center text-[13px] font-semibold text-[#173120]/45">
					Geen agenda-items beschikbaar
				</div>
			)}
		</section>
	);
}

export default function OutdoorGames() {
	const [games, setGames] = useState([]);
	const [trainingSessions, setTrainingSessions] = useState([]);
	const [sponsors, setSponsors] = useState([]);
	const [currentTime, setCurrentTime] = useState(null);
	const [featuredTakeover, setFeaturedTakeover] = useState(null);
	const [liveMatch, setLiveMatch] = useState(null);
	const [demoMatch, setDemoMatch] = useState(null);
	const [clubContent, setClubContent] = useState({ news: [], agenda: [] });
	const isLocalhost = useSyncExternalStore(
		() => () => {},
		() =>
			window.location.hostname === "localhost" ||
			window.location.hostname === "127.0.0.1" ||
			window.location.hostname === "::1",
		() => false
	);
	const [eventQueue, setEventQueue] = useState([]);
	const activeLiveEvent = eventQueue[0] ?? null;
	const [finalSnapshotPending, setFinalSnapshotPending] = useState(false);
	const initializedMatchIdRef = useRef(null);
	const seenActionIdsRef = useRef(new Set());
	const livePriorityRef = useRef(false);
	const demoMatchRef = useRef(null);
	const finalSnapshotPendingRef = useRef(false);
	const demoEventCounterRef = useRef(0);

	const mergeLiveMatchIntoGames = useCallback((match) => {
		setGames((currentGames) => {
			const withoutOldDemo = currentGames.filter(
				(game) => !String(game.id).startsWith("demo-") || game.id === match.id
			);
			const matchIndex = withoutOldDemo.findIndex((game) => game.id === match.id);

			if (matchIndex === -1) return [...withoutOldDemo, match];

			const nextGames = [...withoutOldDemo];
			nextGames[matchIndex] = { ...nextGames[matchIndex], ...match };
			return nextGames;
		});
	}, []);

	const persistSeenActionIds = useCallback((matchId) => {
		try {
			window.localStorage.setItem(
				`${LIVE_SEEN_STORAGE_PREFIX}${matchId}`,
				JSON.stringify(Array.from(seenActionIdsRef.current).slice(-250))
			);
		} catch {
			// Local storage can be unavailable in privacy mode; live reporting still works.
		}
	}, []);

	const applyLiveSnapshot = useCallback((match) => {
		if (!match?.id) return;

		const chronologicalActions = sortActionsChronologically(match.actions);
		setLiveMatch(match);
		mergeLiveMatchIntoGames(match);

		if (initializedMatchIdRef.current !== match.id) {
			initializedMatchIdRef.current = match.id;
			let persistedIds = [];

			try {
				persistedIds = JSON.parse(
					window.localStorage.getItem(`${LIVE_SEEN_STORAGE_PREFIX}${match.id}`) ?? "[]"
				);
			} catch {
				persistedIds = [];
			}

			// Every first snapshot is a baseline. Persisted IDs protect reloads, while
			// adding the current timeline prevents old events from animating afterward.
			seenActionIdsRef.current = new Set([
				...(Array.isArray(persistedIds) ? persistedIds : []),
				...chronologicalActions.map((action) => action.id),
			]);
			persistSeenActionIds(match.id);
			return;
		}

		const newActions = chronologicalActions.filter(
			(action) => !seenActionIdsRef.current.has(action.id)
		);

		for (const action of newActions) seenActionIdsRef.current.add(action.id);
		if (newActions.length > 0) persistSeenActionIds(match.id);

		const alertEvents = newActions
			.filter(isActionableLiveEvent)
			.map((action) => ({ action, match }));

		if (alertEvents.length > 0) {
			livePriorityRef.current = true;
			setFeaturedTakeover((current) =>
				current ? { ...current, exiting: true } : current
			);
			setEventQueue((currentQueue) => [...currentQueue, ...alertEvents]);
		}
	}, [mergeLiveMatchIntoGames, persistSeenActionIds]);

	const showFeaturedSponsor = useCallback((sponsor) => {
		if (livePriorityRef.current) return;
		setFeaturedTakeover((current) => current ?? { sponsor, exiting: false });
	}, []);
	const finishFeaturedSponsor = useCallback(() => {
		setFeaturedTakeover((current) => current?.exiting ? null : current);
	}, []);
	const finishLiveEvent = useCallback((eventId) => {
		setEventQueue((currentQueue) =>
			currentQueue[0]?.action?.id === eventId
				? currentQueue.slice(1)
				: currentQueue
		);
	}, []);

	useEffect(() => {
		demoMatchRef.current = demoMatch;
	}, [demoMatch]);

	useEffect(() => {
		const activeEventId = activeLiveEvent?.action?.id;
		if (!activeEventId) return undefined;

		// The takeover's animationend event normally advances the queue. This
		// watchdog covers browsers that suppress animation events after a tab or
		// display wakes up.
		const eventTimeout = window.setTimeout(() => {
			finishLiveEvent(activeEventId);
		}, LIVE_EVENT_DURATION_MS + 500);

		return () => window.clearTimeout(eventTimeout);
	}, [activeLiveEvent?.action?.id, finishLiveEvent]);

	useEffect(() => {
		if (activeLiveEvent || eventQueue.length > 0) return;

		livePriorityRef.current = false;

		if (!finalSnapshotPending) return;
		const clearFinalTimeout = window.setTimeout(() => {
			setLiveMatch(null);
			setFinalSnapshotPending(false);
			finalSnapshotPendingRef.current = false;
		}, 2_000);

		return () => window.clearTimeout(clearFinalTimeout);
	}, [activeLiveEvent, eventQueue.length, finalSnapshotPending]);

	useEffect(() => {
		if (!featuredTakeover) return undefined;

		if (featuredTakeover.exiting) {
			// Animation events are the primary lifecycle. This only guards against a
			// browser suppressing the event (for example after a visibility change).
			const fallbackTimeout = window.setTimeout(
				finishFeaturedSponsor,
				FEATURED_SPONSOR_EXIT_MS + 250
			);

			return () => window.clearTimeout(fallbackTimeout);
		}

		const visibleTimeout = window.setTimeout(() => {
			setFeaturedTakeover((current) =>
				current ? { ...current, exiting: true } : null
			);
		}, FEATURED_SPONSOR_DURATION_MS);

		return () => window.clearTimeout(visibleTimeout);
	}, [featuredTakeover, finishFeaturedSponsor]);

	useEffect(() => {
		for (const sponsor of sponsors) {
			if (sponsor.featured && sponsor.featuredImageUrl) {
				const preload = new window.Image();
				preload.src = sponsor.featuredImageUrl;
			}
		}
	}, [sponsors]);

	useEffect(() => {
		const syncGames = async () => {
			try {
				const response = await fetch("/api/games");

				if (!response.ok) {
					throw new Error(`Failed to fetch games: ${response.status}`);
				}

				const data = await response.json();
				const nextGames = Array.isArray(data?.duivesteynGames)
					? data.duivesteynGames
					: [];
				setGames(
					demoMatchRef.current ? [...nextGames, demoMatchRef.current] : nextGames
				);
			} catch (error) {
				console.error("Failed to fetch outdoor games", error);
				setGames([]);
			}
		};

		syncGames();
		const refreshInterval = window.setInterval(syncGames, REFRESH_INTERVAL_MS);

		return () => window.clearInterval(refreshInterval);
	}, []);

	useEffect(() => {
		let isActive = true;

		const syncTrainingSessions = async () => {
			try {
				const response = await fetch("/api/training-sessions");
				if (!response.ok) throw new Error(`Failed to fetch training sessions: ${response.status}`);
				const data = await response.json();
				if (isActive) setTrainingSessions(Array.isArray(data?.sessions) ? data.sessions : []);
			} catch {
				// Wedstrijden blijven zichtbaar wanneer het handmatige schema niet beschikbaar is.
			}
		};

		syncTrainingSessions();
		const refreshInterval = window.setInterval(syncTrainingSessions, REFRESH_INTERVAL_MS);

		return () => {
			isActive = false;
			window.clearInterval(refreshInterval);
		};
	}, []);

	useEffect(() => {
		if (demoMatch) return undefined;

		let cancelled = false;
		let nextPollTimeout;

		const syncLiveMatch = async () => {
			let pollAfterMs = LIVE_POLL_INTERVAL_MS;

			try {
				const response = await fetch("/api/live-match");
				if (!response.ok) throw new Error(`Live match request failed: ${response.status}`);

				const data = await response.json();
				pollAfterMs = Number.isFinite(data?.pollAfterMs)
					? Math.max(data.pollAfterMs, LIVE_POLL_INTERVAL_MS)
					: LIVE_POLL_INTERVAL_MS;

				if (!cancelled && data?.match) {
					applyLiveSnapshot(data.match);
					finalSnapshotPendingRef.current = data.active === false;
					setFinalSnapshotPending(finalSnapshotPendingRef.current);
				} else if (!cancelled && data?.active === false && !finalSnapshotPendingRef.current) {
					setLiveMatch(null);
				}
			} catch {
				// The kiosk deliberately keeps its normal layout when live reporting is unavailable.
			}

			if (!cancelled) {
				nextPollTimeout = window.setTimeout(syncLiveMatch, pollAfterMs);
			}
		};

		syncLiveMatch();

		return () => {
			cancelled = true;
			window.clearTimeout(nextPollTimeout);
		};
	}, [applyLiveSnapshot, demoMatch]);

	useEffect(() => {
		const firstClockFrame = window.requestAnimationFrame(() => {
			setCurrentTime(new Date());
		});
		const clockInterval = window.setInterval(() => {
			setCurrentTime(new Date());
		}, CLOCK_INTERVAL_MS);

		return () => {
			window.cancelAnimationFrame(firstClockFrame);
			window.clearInterval(clockInterval);
		};
	}, []);

	useEffect(() => {
		let isActive = true;

		const syncClubContent = async () => {
			try {
				const response = await fetch("/api/club-content");
				if (!response.ok) throw new Error(`Failed to fetch club content: ${response.status}`);

				const data = await response.json();
				if (isActive) {
					setClubContent({
						news: Array.isArray(data?.news) ? data.news : [],
						agenda: Array.isArray(data?.agenda) ? data.agenda : [],
					});
				}
			} catch {
				// Keep the last successful content when the club website is unavailable.
			}
		};

		syncClubContent();
		const refreshInterval = window.setInterval(syncClubContent, 15 * 60 * 1000);

		return () => {
			isActive = false;
			window.clearInterval(refreshInterval);
		};
	}, []);

	useEffect(() => {
		let isActive = true;

		const syncSponsors = async () => {
			try {
				const response = await fetch("/api/sponsors");
				if (!response.ok) throw new Error(`Failed to fetch sponsors: ${response.status}`);

				const data = await response.json();
				if (isActive) {
					setSponsors(Array.isArray(data?.sponsors) ? data.sponsors : []);
				}
			} catch (error) {
				console.error("Failed to fetch outdoor sponsors", error);
				if (isActive) setSponsors([]);
			}
		};

		syncSponsors();
		const refreshInterval = window.setInterval(syncSponsors, 15 * 60 * 1000);

		return () => {
			isActive = false;
			window.clearInterval(refreshInterval);
		};
	}, []);

	const startDemo = useCallback((teamCode) => {
		const match = makeDemoMatch(teamCode);
		initializedMatchIdRef.current = null;
		seenActionIdsRef.current = new Set();
		demoEventCounterRef.current = 0;
		finalSnapshotPendingRef.current = false;
		setFinalSnapshotPending(false);
		setEventQueue([]);
		setFeaturedTakeover((current) =>
			current ? { ...current, exiting: true } : current
		);
		demoMatchRef.current = match;
		setDemoMatch(match);
		applyLiveSnapshot(match);
	}, [applyLiveSnapshot]);

	const addDemoEvent = useCallback((eventType) => {
		const current = demoMatchRef.current;
		if (!current) return;

		demoEventCounterRef.current += 1;
		const eventNumber = demoEventCounterRef.current;
		const isHomeGoal = eventType === "home-goal";
		const isAwayGoal = eventType === "away-goal";
		const isGoal = isHomeGoal || isAwayGoal;
		const actionType = eventType === "green-card"
			? "card-green"
			: eventType === "yellow-card"
				? "card-yellow"
				: eventType === "red-card"
					? "card-red"
					: eventNumber % 3 === 0
						? "goal-pc"
						: "goal";
		const action = {
			id: `demo-event-${Date.now()}-${eventNumber}`,
			action: isGoal ? "goal" : "card",
			action_type: actionType,
			side: isAwayGoal ? "away" : "home",
			person_name: isGoal
				? isHomeGoal
					? "Noa van Cartouche"
					: "Speler tegenstander"
				: "Noa van Cartouche",
			seconds_since_start: Math.min(4_199, 240 + eventNumber * 287),
		};
		const updatedMatch = {
			...current,
			home_score: current.home_score + (isHomeGoal ? 1 : 0),
			away_score: current.away_score + (isAwayGoal ? 1 : 0),
			actions: [action, ...current.actions],
		};

		demoMatchRef.current = updatedMatch;
		setDemoMatch(updatedMatch);
		applyLiveSnapshot(updatedMatch);
	}, [applyLiveSnapshot]);

	const endDemo = useCallback(() => {
		demoMatchRef.current = null;
		initializedMatchIdRef.current = null;
		seenActionIdsRef.current = new Set();
		livePriorityRef.current = false;
		finalSnapshotPendingRef.current = false;
		setDemoMatch(null);
		setLiveMatch(null);
		setEventQueue([]);
		setFinalSnapshotPending(false);
		setGames((currentGames) =>
			currentGames.filter((game) => !String(game.id).startsWith("demo-"))
		);
	}, []);

	const todaysTrainings = materializeTodaysTrainings(trainingSessions, currentTime ?? new Date());
	const assignedMatches = [...games.filter((game) => game.field), ...todaysTrainings];
	return (
		<>
			<Head>
				<title>Cartouche Outdoor</title>
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
			</Head>

			<KioskStage>
				<div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#071a12_0%,#0b291b_34%,#102f1f_100%)] px-[34px] py-5 text-white">
					<header className="flex items-center justify-between gap-8">
						<div className="flex items-center gap-3">
						
							<div className="rounded-[12px] border border-white/[0.12] bg-white p-1">
								<Image src="/cartouche.png" alt="Cartouche logo" width={40} height={40} />
							</div>
							<h1 className="text-[32px] font-semibold leading-none">
								V.M.H.C. Cartouche
							</h1>
						</div>

						<div className="flex flex-col items-end text-right">
							<time
								dateTime={currentTime?.toISOString()}
								className="text-[40px] font-semibold leading-none tracking-[-0.03em] text-white tabular-nums"
							>
								{currentTime ? format(currentTime, "HH:mm") : "--:--"}
							</time>
							<span className="mt-1.5 text-[15px] font-medium capitalize leading-none text-white/70">
								{currentTime ? format(currentTime, "EEEE d MMMM") : ""}
							</span>
						</div>
					</header>

					<main className="mt-4 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_148px] gap-7 overflow-hidden">
						<div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_420px] gap-[26px]">
							<div className="grid min-h-0 min-w-0 grid-cols-3 gap-7">
								<div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,0.82fr)_minmax(0,1fr)] gap-7">
									<FieldCard fieldConfig={FIELD_LAYOUT[0]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[1]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[2]} matches={assignedMatches} />
								</div>

								<div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,0.82fr)_minmax(0,1fr)] gap-7">
									<FieldCard fieldConfig={FIELD_LAYOUT[3]} matches={assignedMatches} />

									<UtilityCard title="Clubhuis" muted />

									<UtilityCard title="Fietsenstalling" muted />
								</div>

								<div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,0.82fr)_minmax(0,1fr)] gap-7">
									<FieldCard fieldConfig={FIELD_LAYOUT[4]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[5]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[6]} matches={assignedMatches} />
								</div>
							</div>

							<aside className="min-h-0">
								{liveMatch ? (
									<LiveMatchHistory match={liveMatch} />
								) : (
									<div className="grid h-full min-h-0 grid-rows-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-7">
										<ClubNewsPanel items={clubContent.news} />
										<ClubAgendaPanel items={clubContent.agenda} />
									</div>
								)}
							</aside>
						</div>

						<SponsorStrip
							sponsors={sponsors}
							onFeaturedSponsor={showFeaturedSponsor}
							paused={Boolean(featuredTakeover || activeLiveEvent || eventQueue.length)}
						/>
					</main>

					{featuredTakeover ? (
						<FeaturedSponsorTakeover
							sponsor={featuredTakeover.sponsor}
							exiting={featuredTakeover.exiting}
							onExitComplete={finishFeaturedSponsor}
						/>
					) : null}

					{activeLiveEvent ? (
						<LiveEventTakeover
							key={activeLiveEvent.action.id}
							action={activeLiveEvent.action}
							match={activeLiveEvent.match}
							onComplete={() => finishLiveEvent(activeLiveEvent.action.id)}
						/>
					) : null}
				</div>
			</KioskStage>

			{isLocalhost ? (
				<DebugControls
					demoMatch={demoMatch}
					onStartDemo={startDemo}
					onAddDemoEvent={addDemoEvent}
					onEndDemo={endDemo}
				/>
			) : null}

			<style jsx global>{`
				@keyframes outdoor-sponsors-left {
					from { transform: translateX(0); }
					to { transform: translateX(-50%); }
				}

				@keyframes featured-takeover-in {
					from { opacity: 0; transform: translateY(430px) scale(0.14); border-radius: 90px; }
					to { opacity: 1; transform: translateY(0) scale(1); border-radius: 30px; }
				}

				@keyframes featured-takeover-out {
					from { opacity: 1; transform: translateY(0) scale(1); border-radius: 30px; }
					to { opacity: 0; transform: translateY(430px) scale(0.14); border-radius: 90px; }
				}

				@keyframes featured-backdrop-in {
					from { opacity: 0; }
					to { opacity: 1; }
				}

				@keyframes featured-backdrop-out {
					from { opacity: 1; }
					to { opacity: 0; }
				}

				.featured-takeover-card {
					transform-origin: center bottom;
				}

				.featured-takeover-card.is-entering {
					animation: featured-takeover-in 800ms cubic-bezier(0.2, 0.82, 0.24, 1) both;
				}

				.sponsor-track-paused {
					animation-play-state: paused !important;
				}

				.featured-takeover-card.is-exiting {
					animation: featured-takeover-out var(--featured-sponsor-exit-duration) cubic-bezier(0.72, 0, 0.78, 0.18) both;
				}

				.featured-takeover-backdrop {
					background: rgba(8, 11, 9, 0.52);
					backdrop-filter: grayscale(0.88) brightness(0.42) blur(1.5px);
				}

				.featured-takeover-backdrop.is-entering {
					animation: featured-backdrop-in 500ms ease-out both;
				}

				.featured-takeover-backdrop.is-exiting {
					animation: featured-backdrop-out var(--featured-sponsor-exit-duration) ease-in both;
				}
			`}</style>
		</>
	);
}
