import Head from "next/head";
import Image from "next/image";
import { format, isToday, setDefaultOptions } from "date-fns";
import { nl } from "date-fns/locale";
import { CircleOff, Clock3, MapPinned } from "lucide-react";
import { useEffect, useState } from "react";

setDefaultOptions({ locale: nl });

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1080;
const REFRESH_INTERVAL_MS = 120000;
const CLOCK_INTERVAL_MS = 30000;
const LIVE_WINDOW_MS = 110 * 60 * 1000;
const DEMO_FORCE_LIVE = false;

const FIELD_LAYOUT = [
	{
		name: "Veld 2",
		rotation: "vertical",
		aliases: ["veld 2", "kunstgrasveld 2", "kunstgras veld 2"],
		spotLabel: "",
	},
	{
		name: "LG",
		rotation: "horizontal",
		aliases: ["lg"],
		spotLabel: "",
	},
	{
		name: "Veld 5",
		rotation: "vertical",
		aliases: ["veld 5", "kunstgrasveld 5", "kunstgras veld 5"],
		spotLabel: "",
	},
	{
		name: "Veld 1",
		rotation: "vertical",
		aliases: ["veld 1", "rabobank"],
		spotLabel: "Hoofdveld",
	},
	{
		name: "Veld 3",
		rotation: "vertical",
		aliases: ["veld 3", "jumbo koomneef"],
		spotLabel: "",
	},
	{
		name: "Mini",
		rotation: "horizontal",
		aliases: ["mini"],
		spotLabel: "Jeugd",
	},
	{
		name: "Veld 4",
		rotation: "vertical",
		aliases: ["veld 4", "sk bouw"],
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

function formatDateLabel(value) {
	const date = new Date(value);
	const formatted = isToday(date)
		? format(date, "HH:mm")
		: format(date, "EEE d MMM • HH:mm");

	return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function getMatchState(match, now = new Date()) {
	const start = new Date(match.datetime);
	const end = new Date(start.getTime() + LIVE_WINDOW_MS);

	if (match.status === "final" || now > end) {
		return "finished";
	}

	if (now >= start && now <= end) {
		return "live";
	}

	return "upcoming";
}

function matchesField(fieldConfig, rawFieldName) {
	const normalized = normalizeText(rawFieldName);

	if (!normalized) {
		return false;
	}

	return fieldConfig.aliases.some((alias) => normalized.includes(normalizeText(alias)));
}

function pickFieldMatches(matches, fieldConfig) {
	const now = new Date();
	const sortedMatches = matches
		.filter((match) => matchesField(fieldConfig, match.field))
		.sort((left, right) => new Date(left.datetime) - new Date(right.datetime));

	let currentMatch = null;
	const upcomingMatches = [];

	for (const match of sortedMatches) {
		const state = getMatchState(match, now);

		if (state === "live" && !currentMatch) {
			currentMatch = match;
			continue;
		}

		if (state === "upcoming") {
			if (DEMO_FORCE_LIVE && !currentMatch) {
				currentMatch = match;
				continue;
			}
			if (upcomingMatches.length < 2) {
				upcomingMatches.push(match);
			}
		}

		if (currentMatch && upcomingMatches.length >= 1) {
			break;
		}

		if (!currentMatch && upcomingMatches.length >= 2) {
			break;
		}
	}

	return {
		currentMatch,
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
					className="overflow-hidden"
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
	const containerClassName = secondary ? "rounded-lg bg-white px-3 py-2 text-[#132317] shadow-md" : "rounded-lg bg-white px-3 py-3 text-[#132317] shadow-md";
	const emptyContainerClassName = secondary ? "rounded-lg bg-white/80 px-3 py-2 text-[#6e7f74] shadow-md" : "rounded-lg bg-white/80 px-3 py-3 text-[#6e7f74] shadow-md";

	if (!match) {
		return (
			<div className={emptyContainerClassName}>
				<div className="flex items-center justify-center gap-2 text-center">
					<CircleOff className={compact ? "h-4 w-4" : secondary ? "h-4 w-4" : "h-5 w-5"} />
					<span className={compact ? "text-[13px]" : secondary ? "text-[13px]" : "text-[14px]"}>
						Geen wedstrijd gepland
					</span>
				</div>
			</div>
		);
	}

	const timeText = isToday(new Date(match.datetime))
		? format(new Date(match.datetime), "HH:mm")
		: formatDateLabel(match.datetime);
	const isLiveMatch = getMatchState(match) === "live" || (DEMO_FORCE_LIVE && !secondary);
	const metaClassName = compact ? "text-[9px]" : secondary ? "text-[9px]" : "text-[10px]";
	const teamClassName = compact ? "text-[13px]" : secondary ? "text-[18px]" : "text-[22px]";
	const scoreClassName = compact ? "min-w-[38px] text-[13px]" : secondary ? "min-w-[42px] text-[14px]" : "min-w-[46px] text-[16px]";
	const logoClassName = compact ? "h-6 w-6" : secondary ? "h-6 w-6" : "h-7 w-7";
	const labelClassName = compact ? "text-[10px]" : secondary ? "text-[9px]" : "text-[10px]";
	const timeClassName = compact ? "text-[14px]" : secondary ? "text-[14px]" : "text-[16px]";
	const bodySpacingClassName = secondary ? "min-w-0 flex-1 space-y-1.5" : "min-w-0 flex-1 space-y-2";

	return (
		<div className={containerClassName}>
			<div className={`${secondary ? "mb-1.5" : "mb-2"} flex items-center justify-between gap-3`}>
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
	const { currentMatch, upcomingMatches } = pickFieldMatches(matches, fieldConfig);
	const compact = fieldConfig.rotation === "horizontal";
	const [nextMatch, followingMatch] = upcomingMatches;
	const primaryMatch = currentMatch || nextMatch || null;
	const secondaryMatch = currentMatch ? nextMatch || null : followingMatch || null;
	const shouldShowSecondaryCard = Boolean(primaryMatch || secondaryMatch);
	const statusLabel = currentMatch
		? "Nu bezig"
		: nextMatch
			? "Volgende wedstrijd"
			: "Vrij veld";

	return (
		<section className="relative h-full overflow-hidden rounded-[20px] border border-white/10 bg-[#0d5d38] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.26)]">
			{/* <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_38%),linear-gradient(180deg,_rgba(255,255,255,0.08),_transparent_32%)]" /> */}
			{/* <PitchLines rotation={fieldConfig.rotation} /> */}

			<div className="relative z-10 flex h-full flex-col p-3 text-white">

				<div className={`${compact ? "text-[18px]" : "text-[22px]"} font-semibold leading-none mx-auto`}>
					{fieldConfig.name}
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

				<div className="flex flex-1 flex-col justify-center space-y-2">
					<GameCard
						label="Volgende"
						match={primaryMatch}
						compact={compact}
					/>
					{shouldShowSecondaryCard ? (
						<GameCard
						label={currentMatch ? "Hierna" : "Daarna"}
						match={secondaryMatch}
						compact={compact}
						secondary
					/>
				) : null}
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

export default function OutdoorGames() {
	const [games, setGames] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [lastUpdated, setLastUpdated] = useState(null);

	useEffect(() => {
		const syncGames = async () => {
			setLoading(true);

			try {
				const response = await fetch("/api/games");

				if (!response.ok) {
					throw new Error(`Failed to fetch games: ${response.status}`);
				}

				const data = await response.json();
				setGames(Array.isArray(data?.duivesteynGames) ? data.duivesteynGames : []);
				setLastUpdated(new Date());
			} catch (error) {
				console.error("Failed to fetch outdoor games", error);
				setGames([]);
			} finally {
				setLoading(false);
			}
		};

		syncGames();
		const refreshInterval = window.setInterval(syncGames, REFRESH_INTERVAL_MS);

		return () => window.clearInterval(refreshInterval);
	}, []);

	useEffect(() => {
		const clockInterval = window.setInterval(() => {
			setCurrentTime(new Date());
		}, CLOCK_INTERVAL_MS);

		return () => window.clearInterval(clockInterval);
	}, []);

	const assignedMatches = games.filter((game) => game.field);
	const unassignedMatches = games.filter((game) => !game.field);
	const liveFieldCount = FIELD_LAYOUT.filter(
		(fieldConfig) => pickFieldMatches(assignedMatches, fieldConfig).currentMatch
	).length;
	const nextStartsAt = assignedMatches
		.filter((game) => getMatchState(game, currentTime) === "upcoming")
		.sort((left, right) => new Date(left.datetime) - new Date(right.datetime))[0];
	const totalScheduledOnFields = FIELD_LAYOUT.reduce((total, fieldConfig) => {
		return total + pickFieldMatches(assignedMatches, fieldConfig).allMatches.length;
	}, 0);

	return (
		<>
			<Head>
				<title>Cartouche Outdoor</title>
			</Head>

			<KioskStage>
				<div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#071a12_0%,#0b291b_34%,#102f1f_100%)] px-5 py-5 text-white">
					<header className="flex items-center justify-between gap-4">
						
						<div className="flex items-center gap-3">
							<div className="rounded-[12px] border border-white/[0.12] bg-white p-1">
								<Image src="/cartouche.png" alt="Cartouche logo" width={40} height={40} />
							</div>
							<h1 className="text-[32px] font-semibold leading-none">
								Sportpark Duivesteyn
							</h1>
						</div>

						<div className="mt-2 flex flex-col gap-1 text-[13px] text-white/[0.76]">
							<span className="flex items-center gap-1.5">
								<MapPinned className="h-4 w-4" />
								Sportpark DuiveSteyn
							</span>
							<span className="flex items-center gap-1.5">
								<Clock3 className="h-4 w-4" />
								{format(currentTime, "EEEE d MMMM • HH:mm")}
							</span>
						</div>
					</header>

					<main className="mt-4 grid flex-1 grid-cols-3 gap-8 overflow-hidden">
						<div className="grid h-full grid-rows-[1fr_0.64fr_1fr] gap-8">
							<FieldCard fieldConfig={FIELD_LAYOUT[0]} matches={assignedMatches} />
							<FieldCard fieldConfig={FIELD_LAYOUT[1]} matches={assignedMatches} />
							<FieldCard fieldConfig={FIELD_LAYOUT[2]} matches={assignedMatches} />
						</div>

						<div className="grid h-full grid-rows-[1fr_0.64fr_1fr] gap-8">
							<FieldCard fieldConfig={FIELD_LAYOUT[3]} matches={assignedMatches} />

							<UtilityCard title="Clubhuis" />

							<UtilityCard title="Fietsenstalling" muted />
						</div>

						<div className="grid h-full grid-rows-[1fr_0.64fr_1fr] gap-8">
							<FieldCard fieldConfig={FIELD_LAYOUT[4]} matches={assignedMatches} />
							<FieldCard fieldConfig={FIELD_LAYOUT[5]} matches={assignedMatches} />
							<FieldCard fieldConfig={FIELD_LAYOUT[6]} matches={assignedMatches} />
						</div>
					</main>
				</div>
			</KioskStage>
		</>
	);
}
