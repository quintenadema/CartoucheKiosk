import Image from "next/image";
import {
	Bug,
	Flag,
	Play,
	ShieldAlert,
	Sparkles,
	X,
	Zap,
} from "lucide-react";

export const LIVE_POLL_INTERVAL_MS = 12_000;
export const LIVE_EVENT_DURATION_MS = 10_900;

const HIDDEN_HISTORY_TYPES = new Set(["submit", "time-travel"]);

function eventMinute(action) {
	if (!Number.isFinite(action?.seconds_since_start)) return "—";
	return `${Math.ceil(action.seconds_since_start / 60)}′`;
}

function cardColor(actionType) {
	if (actionType === "card-red") return "#dc2626";
	if (actionType === "card-yellow") return "#f5c518";
	return "#20a464";
}

export function isActionableLiveEvent(action) {
	return action?.action === "goal" || action?.action === "card";
}

export function sortActionsChronologically(actions) {
	return [...(actions ?? [])].sort((left, right) => {
		const secondsDifference =
			(left.seconds_since_start ?? 0) - (right.seconds_since_start ?? 0);
		return secondsDifference || (left.id ?? 0) - (right.id ?? 0);
	});
}

export function visibleHistoryActions(actions) {
	return sortActionsChronologically(actions)
		.filter((action) => !HIDDEN_HISTORY_TYPES.has(action.action_type))
		.reverse();
}

function getActionCopy(action) {
	if (action.action === "goal") {
		if (action.action_type === "goal-pc") return "Doelpunt uit strafcorner";
		if (action.action_type === "goal-ps") return "Doelpunt uit strafbal";
		if (action.action_type === "shootout") return "Shoot-out gescoord";
		return "Doelpunt";
	}

	if (action.action === "card") {
		if (action.action_type === "card-red") return "Rode kaart";
		if (action.action_type === "card-yellow") return "Gele kaart";
		return "Groene kaart";
	}

	const matchLabels = {
		start: "Wedstrijd begonnen",
		end: "Einde wedstrijd",
		"start-period": "Nieuwe periode",
		"end-period": "Einde periode",
		pause: "Spel stilgelegd",
		resume: "Spel hervat",
		"start-shootout": "Shoot-outs begonnen",
		"end-shootout": "Einde shoot-outs",
		canceled: "Wedstrijd afgelast",
	};

	return matchLabels[action.action_type] ?? "Wedstrijdupdate";
}

function getTeamName(match, side) {
	if (side === "home") return match.home_team.name;
	if (side === "away") return match.away_team.name;
	return "Beide teams";
}

function HistoryEvent({ action, match }) {
	const isGoal = action.action === "goal";
	const isCard = action.action === "card";
	const isCartouche = action.side === "home";
	const accent = isGoal
		? isCartouche
			? "#e5bd45"
			: "#8da096"
		: isCard
			? cardColor(action.action_type)
			: "#789487";

	return (
		<li className="relative grid grid-cols-[42px_9px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
			<time className="pt-0.5 text-right text-[13px] font-bold tabular-nums text-white/55">
				{eventMinute(action)}
			</time>
			<div className="relative flex justify-center">
				<span
					className="relative z-10 mt-1.5 h-[9px] w-[9px] rounded-full ring-4 ring-[#123325]"
					style={{ backgroundColor: accent }}
				/>
				<span className="absolute bottom-[-16px] top-[10px] w-px bg-white/10 last:hidden" />
			</div>
			<div className="min-w-0 rounded-[13px] border border-white/[0.08] bg-black/10 px-3 py-2.5">
				<div className="flex items-center justify-between gap-2">
					<p className="truncate text-[14px] font-bold leading-none text-white">
						{getActionCopy(action)}
					</p>
					{isGoal || isCard ? (
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-sm"
							style={{ backgroundColor: accent }}
						/>
					) : null}
				</div>
				<p className="mt-1.5 truncate text-[11px] font-medium text-white/55">
					{action.person_name || getTeamName(match, action.side)}
				</p>
			</div>
		</li>
	);
}

export function LiveMatchHistory({ match }) {
	const actions = visibleHistoryActions(match.actions);
	const isPreMatch = match.status === "scheduled" || match.status === "announced";

	return (
		<section className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#d9c16e]/30 bg-[linear-gradient(155deg,#164a31_0%,#0b2c1d_55%,#071b12_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_70px_rgba(0,0,0,0.32)]">
			<div className="absolute -right-20 -top-20 h-64 w-64 rounded-full border border-white/[0.06]" />
			<div className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/[0.06]" />

			<header className="relative border-b border-white/[0.09] px-6 pb-5 pt-6">
				<div className="flex items-center justify-between gap-4">
					<div className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-red-100">
						<span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
						{isPreMatch ? "Straks live" : "Live verslag"}
					</div>
					<span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e5bd45]">
						{match.team_label}
					</span>
				</div>

				<div className="mt-5 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
					<div className="min-w-0 text-left">
						<p className="truncate text-[20px] font-bold leading-tight text-white">
							{match.home_team.name}
						</p>
					</div>
					<div className="flex items-center gap-2 text-[31px] font-black tabular-nums text-white">
						<span>{match.home_score ?? 0}</span>
						<span className="text-white/25">–</span>
						<span>{match.away_score ?? 0}</span>
					</div>
					<div className="min-w-0 text-right">
						<p className="truncate text-[20px] font-bold leading-tight text-white">
							{match.away_team.name}
						</p>
					</div>
				</div>
			</header>

			<div className="relative flex min-h-0 flex-1 flex-col px-5 pb-5 pt-4">
				{actions.length > 0 ? (
					<ol className="live-history-scroll min-h-0 flex-1 overflow-y-auto pr-2">
						{actions.map((action) => (
							<HistoryEvent key={action.id} action={action} match={match} />
						))}
					</ol>
				) : (
					<div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[18px] border border-dashed border-white/10 bg-black/10 px-8 text-center">
						<Flag className="h-8 w-8 text-[#e5bd45]/75" strokeWidth={1.6} />
						<p className="mt-4 text-[15px] font-bold text-white/75">
							{isPreMatch ? "Het liveverslag start bij de afslag." : "Nog geen gebeurtenissen gemeld."}
						</p>
					</div>
				)}
			</div>
		</section>
	);
}

function takeoverPresentation(action, match) {
	const isCartouche = action.side === "home";
	const teamName = getTeamName(match, action.side);

	if (action.action === "goal") {
		const title = action.action_type === "goal-pc"
			? "GOAL UIT STRAFCORNER"
			: action.action_type === "goal-ps"
				? "STRAFBAL BENUT"
				: "DOELPUNT";

		return {
			kind: "goal",
			title,
			kicker: isCartouche ? "CARTOUCHE SCOORT" : "TEGENDOELPUNT",
			teamName,
			accent: isCartouche ? "#e5bd45" : "#d7e0db",
			background: isCartouche
				? "linear-gradient(135deg,#087544 0%,#064d30 42%,#071b12 100%)"
				: "linear-gradient(135deg,#27322c 0%,#111a15 55%,#070b09 100%)",
			Icon: isCartouche ? Sparkles : Zap,
		};
	}

	const color = cardColor(action.action_type);
	const title = action.action_type === "card-red"
		? "RODE KAART"
		: action.action_type === "card-yellow"
			? "GELE KAART"
			: "GROENE KAART";

	return {
		kind: "card",
		title,
		kicker: isCartouche ? "KAART VOOR CARTOUCHE" : "KAART VOOR DE TEGENSTANDER",
		teamName,
		accent: color,
		background: `linear-gradient(135deg,${color} 0%,#101712 56%,#060907 100%)`,
		Icon: ShieldAlert,
	};
}

export function LiveEventTakeover({ action, match, onComplete }) {
	const presentation = takeoverPresentation(action, match);
	const Icon = presentation.Icon;

	return (
		<div
			className="live-event-takeover pointer-events-none absolute inset-0 z-[70] overflow-hidden"
			role="alert"
			aria-live="assertive"
			onAnimationEnd={(event) => {
				if (
					event.target === event.currentTarget &&
					event.animationName === "live-event-shell"
				) {
					onComplete?.();
				}
			}}
			style={{
				"--live-accent": presentation.accent,
				"--live-event-duration": `${LIVE_EVENT_DURATION_MS}ms`,
				background: presentation.background,
			}}
		>
			<div className="relative flex h-full flex-col items-center justify-center px-24 text-center text-white">
				<div className="live-event-mark relative mb-7 flex h-[116px] w-[116px] items-center justify-center rounded-full border border-white/20 bg-black/15 shadow-[0_20px_70px_rgba(0,0,0,0.28)]">
					{action.side === "home" && presentation.kind === "goal" ? (
						<Image src="/cartouche.png" alt="Cartouche" width={88} height={88} className="h-[88px] w-[88px] object-contain" />
					) : presentation.kind === "card" ? (
						<div
							className="h-[72px] w-[48px] rotate-[-7deg] rounded-[7px] border-2 border-white/45 shadow-[0_15px_35px_rgba(0,0,0,0.35)]"
							style={{ backgroundColor: presentation.accent }}
						/>
					) : (
						<Icon className="h-14 w-14" strokeWidth={1.5} />
					)}
				</div>

				<p className="live-event-kicker text-[18px] font-black uppercase tracking-[0.38em] text-white/70">
					{presentation.kicker}
				</p>
				<h2 className="live-event-title mt-4 text-[104px] font-black leading-[0.9] tracking-[-0.055em]">
					{presentation.title}
				</h2>
				<p className="live-event-person mt-7 text-[29px] font-bold text-white/85">
					{action.person_name || presentation.teamName}
					<span className="mx-3 text-white/25">•</span>
					{eventMinute(action)}
				</p>

				{presentation.kind === "goal" ? (
					<div className="live-event-score mt-9 flex items-center gap-5 rounded-full border border-white/15 bg-black/15 px-8 py-3 text-[32px] font-black tabular-nums shadow-[0_14px_45px_rgba(0,0,0,0.2)]">
						<span>{match.home_team.short_name || match.home_team.name}</span>
						<span className="text-[41px] text-[var(--live-accent)]">{match.home_score ?? 0} – {match.away_score ?? 0}</span>
						<span>{match.away_team.short_name || match.away_team.name}</span>
					</div>
				) : null}
			</div>
		</div>
	);
}

export function DebugControls({ demoMatch, onStartDemo, onAddDemoEvent, onEndDemo }) {
	return (
		<div className="fixed inset-x-0 top-0 z-[100] flex h-[56px] items-center gap-3 border-b border-amber-300/20 bg-[#111812]/95 px-5 text-white shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur">
			<div className="mr-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">
				<Bug className="h-4 w-4" />
				Local demo
			</div>

			{!demoMatch ? (
				<>
					<button type="button" onClick={() => onStartDemo("D1")} className="debug-live-button">
						<Play className="h-3.5 w-3.5" /> Demo Dames 1
					</button>
					<button type="button" onClick={() => onStartDemo("H1")} className="debug-live-button">
						<Play className="h-3.5 w-3.5" /> Demo Heren 1
					</button>
				</>
			) : (
				<>
					<span className="rounded-full bg-red-500/15 px-3 py-1.5 text-[11px] font-bold text-red-100">
						{demoMatch.team_label} live
					</span>
					<button type="button" onClick={() => onAddDemoEvent("home-goal")} className="debug-live-button">
						<Sparkles className="h-3.5 w-3.5" /> Cartouche goal
					</button>
					<button type="button" onClick={() => onAddDemoEvent("away-goal")} className="debug-live-button">
						<Zap className="h-3.5 w-3.5" /> Tegengoal
					</button>
					<button type="button" onClick={() => onAddDemoEvent("green-card")} className="debug-live-button">
						<span className="h-3 w-2 rounded-sm bg-[#20a464]" /> Groen
					</button>
					<button type="button" onClick={() => onAddDemoEvent("yellow-card")} className="debug-live-button">
						<span className="h-3 w-2 rounded-sm bg-[#f5c518]" /> Geel
					</button>
					<button type="button" onClick={() => onAddDemoEvent("red-card")} className="debug-live-button">
						<span className="h-3 w-2 rounded-sm bg-[#dc2626]" /> Rood
					</button>
					<button type="button" onClick={onEndDemo} className="debug-live-button ml-auto border-red-300/25 text-red-100">
						<X className="h-3.5 w-3.5" /> Stop demo
					</button>
				</>
			)}
		</div>
	);
}
