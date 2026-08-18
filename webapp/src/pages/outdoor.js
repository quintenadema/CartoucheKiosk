import Head from "next/head";
import Image from "next/image";
import { format, isToday, setDefaultOptions } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarDays, CircleOff, Clock3, MapPinned, Newspaper } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

setDefaultOptions({ locale: nl });

const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const REFRESH_INTERVAL_MS = 120000;
const CLOCK_INTERVAL_MS = 30000;
const LIVE_WINDOW_MS = 110 * 60 * 1000;
const FEATURED_SPONSOR_DURATION_MS = 10_000;
const FEATURED_SPONSOR_EXIT_MS = 900;
const SPONSOR_CAROUSEL_SPEED_MULTIPLIER = 8;
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
				<div className="flex items-center justify-between">
					<div className={`${compact ? "text-[18px]" : "text-[22px]"} font-semibold leading-none`}>
						{fieldConfig.name}
					</div>
					<div className={`${compact ? "text-[18px]" : "text-[22px]"} font-semibold leading-none`}>
						{fieldConfig.name}
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
									className="flex h-[116px] w-[220px] shrink-0 flex-col items-center justify-center rounded-[17px] border border-[#dfe5dd] bg-[#f8faf6] px-5 py-3 text-center shadow-[0_12px_30px_rgba(0,0,0,0.2)]"
								>
									<img
										src={sponsor.image}
										alt={sponsor.name}
										className="max-h-[70px] w-full object-contain"
										decoding="async"
									/>
									<span className="mt-1.5 line-clamp-1 w-full text-[10px] font-semibold tracking-wide text-[#476052]">
										{sponsor.name}
									</span>
								</div>
							))}
						</div>
					))}
				</div>
			</div>
		</aside>
	);
}

function FeaturedSponsorTakeover({ sponsor, exiting }) {
	return (
		<div className="pointer-events-none absolute inset-0 z-50" role="status" aria-live="polite">
			<div className={`featured-takeover-backdrop absolute inset-0 ${exiting ? "is-exiting" : ""}`} />
			<article className={`featured-takeover-card absolute inset-[42px] overflow-hidden border border-white/15 bg-[#07170f] shadow-[0_44px_120px_rgba(0,0,0,0.7)] ${exiting ? "is-exiting" : ""}`}>
				<img
					src={sponsor.featuredImageUrl}
					alt={`Uitgelichte foto van ${sponsor.name}`}
					className="absolute inset-0 h-full w-full object-contain"
				/>
			</article>
		</div>
	);
}

function InformationPlaceholder({ title, icon: Icon, warm = false }) {
	return (
		<section
			className={`relative h-full overflow-hidden rounded-[24px] border p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_50px_rgba(0,0,0,0.2)] ${
				warm
					? "border-[#d9c69b]/30 bg-[linear-gradient(145deg,#f1dfb8_0%,#dfc17e_100%)] text-[#173120]"
					: "border-white/[0.09] bg-[linear-gradient(145deg,#164a31_0%,#0b2d1d_100%)] text-white"
			}`}
		>
			<div className={`absolute -right-16 -top-16 h-56 w-56 rounded-full border ${warm ? "border-[#173120]/10" : "border-white/10"}`} />
			<div className={`absolute -right-7 -top-7 h-36 w-36 rounded-full border ${warm ? "border-[#173120]/10" : "border-white/10"}`} />

			<div className="relative flex h-full flex-col">
				<div className="flex items-start justify-between gap-4">
					<h2 className="mt-2 text-[32px] font-semibold leading-none">{title}</h2>
					<div className={`flex h-10 w-10 items-center justify-center rounded-[17px] border ${warm ? "border-[#173120]/10 bg-white/30" : "border-white/10 bg-white/[0.07]"}`}>
						<Icon className="h-6 w-6" strokeWidth={1.8} />
					</div>
				</div>

				<div className={`mt-8 flex-1 rounded-[18px] border border-dashed ${warm ? "border-[#173120]/15 bg-white/10" : "border-white/10 bg-black/[0.08]"}`} />
			</div>
		</section>
	);
}

export default function OutdoorGames() {
	const [games, setGames] = useState([]);
	const [sponsors, setSponsors] = useState([]);
	const [loading, setLoading] = useState(true);
	const [currentTime, setCurrentTime] = useState(new Date());
	const [lastUpdated, setLastUpdated] = useState(null);
	const [featuredTakeover, setFeaturedTakeover] = useState(null);

	const showFeaturedSponsor = useCallback((sponsor) => {
		setFeaturedTakeover((current) => current ?? { sponsor, exiting: false });
	}, []);

	useEffect(() => {
		if (!featuredTakeover) return undefined;

		const timeout = window.setTimeout(
			() => {
				if (featuredTakeover.exiting) {
					setFeaturedTakeover(null);
				} else {
					setFeaturedTakeover((current) => current ? { ...current, exiting: true } : null);
				}
			},
			featuredTakeover.exiting ? FEATURED_SPONSOR_EXIT_MS : FEATURED_SPONSOR_DURATION_MS
		);

		return () => window.clearTimeout(timeout);
	}, [featuredTakeover]);

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
				<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
			</Head>

			<KioskStage>
				<div className="flex h-full flex-col overflow-hidden bg-[linear-gradient(180deg,#071a12_0%,#0b291b_34%,#102f1f_100%)] px-[34px] py-5 text-white">
					<header className="flex items-center justify-between gap-8">
						<div className="flex items-center gap-3">
						
							<div className="rounded-[12px] border border-white/[0.12] bg-white p-1">
								<Image src="/cartouche.png" alt="Cartouche logo" width={40} height={40} />
							</div>
							<h1 className="text-[32px] font-semibold leading-none">
								V.M.H.C. Cartouche
							</h1>
						</div>

						<div className="flex flex-col gap-1 text-[13px] text-white/[0.76]">
							<span className="flex items-center gap-1.5">
								<MapPinned className="h-4 w-4" />
								V.M.H.C. Cartouche
							</span>
							<span className="flex items-center gap-1.5">
								<Clock3 className="h-4 w-4" />
								{format(currentTime, "EEEE d MMMM • HH:mm")}
							</span>
						</div>
					</header>

					<main className="mt-4 grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_148px] gap-7 overflow-hidden">
						<div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_420px] gap-[26px]">
							<div className="grid min-h-0 min-w-0 grid-cols-3 gap-7">
								<div className="grid h-full grid-rows-[1fr_0.64fr_1fr] gap-7">
									<FieldCard fieldConfig={FIELD_LAYOUT[0]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[1]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[2]} matches={assignedMatches} />
								</div>

								<div className="grid h-full grid-rows-[1fr_0.64fr_1fr] gap-7">
									<FieldCard fieldConfig={FIELD_LAYOUT[3]} matches={assignedMatches} />

									<UtilityCard title="Clubhuis" />

									<UtilityCard title="Fietsenstalling" muted />
								</div>

								<div className="grid h-full grid-rows-[1fr_0.64fr_1fr] gap-7">
									<FieldCard fieldConfig={FIELD_LAYOUT[4]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[5]} matches={assignedMatches} />
									<FieldCard fieldConfig={FIELD_LAYOUT[6]} matches={assignedMatches} />
								</div>
							</div>

							<aside className="grid min-h-0 grid-rows-2 gap-7">
								<InformationPlaceholder title="Nieuws" icon={Newspaper} />
								<InformationPlaceholder title="Agenda" icon={CalendarDays} warm />
							</aside>
						</div>

						<SponsorStrip
							sponsors={sponsors}
							onFeaturedSponsor={showFeaturedSponsor}
							paused={Boolean(featuredTakeover)}
						/>
					</main>

					{featuredTakeover ? (
						<FeaturedSponsorTakeover
							sponsor={featuredTakeover.sponsor}
							exiting={featuredTakeover.exiting}
						/>
					) : null}
				</div>
			</KioskStage>

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
					animation: featured-takeover-in 800ms cubic-bezier(0.2, 0.82, 0.24, 1) both;
				}

				.sponsor-track-paused {
					animation-play-state: paused !important;
				}

				.featured-takeover-card.is-exiting {
					animation: featured-takeover-out ${FEATURED_SPONSOR_EXIT_MS}ms cubic-bezier(0.72, 0, 0.78, 0.18) both;
				}

				.featured-takeover-backdrop {
					background: rgba(8, 11, 9, 0.52);
					backdrop-filter: grayscale(0.88) brightness(0.42) blur(1.5px);
					animation: featured-backdrop-in 500ms ease-out both;
				}

				.featured-takeover-backdrop.is-exiting {
					animation: featured-backdrop-out ${FEATURED_SPONSOR_EXIT_MS}ms ease-in both;
				}
			`}</style>
		</>
	);
}
