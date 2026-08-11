import { format, setDefaultOptions } from "date-fns";
import { nl } from 'date-fns/locale';
import Head from "next/head";
// Set Dutch as the default locale for all date-fns functions
setDefaultOptions({ locale: nl });

import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Clock, Loader, Megaphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const DESIGN_WIDTH = 1920;

const ScaledWrapper = ({ children }) => {
	const [scale, setScale] = useState(1);
	const wrapperRef = useRef(null);

	useEffect(() => {
		const updateScale = () => {
			setScale(window.innerWidth / DESIGN_WIDTH);
		};
		updateScale();
		window.addEventListener('resize', updateScale);
		return () => window.removeEventListener('resize', updateScale);
	}, []);

	return (
		<div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
			<div
				ref={wrapperRef}
				style={{
					width: DESIGN_WIDTH,
					transformOrigin: 'top left',
					transform: `scale(${scale})`,
				}}
			>
				{children}
			</div>
		</div>
	);
};

const GameCard = ({ game }) => {
	const [isLive, setIsLive] = useState(false);
	const [hasEnded, setHasEnded] = useState(false);

	useEffect(() => {
		const checkGameStatus = () => {
			const now = new Date();
			const gameStart = new Date(game.datetime);
			const gameEnd = new Date(gameStart);
			
			// Set game duration based on day of week (35 min for Saturday, 40 min for Sunday)
			const gameDuration = gameStart.getDay() === 0 ? 40 : 35;
			gameEnd.setMinutes(gameEnd.getMinutes() + gameDuration);

			setIsLive(now >= gameStart && now <= gameEnd);
			setHasEnded(now > gameEnd);
		};

		checkGameStatus();
		const interval = setInterval(checkGameStatus, 30000); // Check every 30 seconds

		return () => clearInterval(interval);
	}, [game]);

	if (hasEnded) return null;

	return (
		<div className="bg-white rounded-lg shadow-md p-4 flex flex-col">
			<div className="flex justify-between items-center mb-3">
				<div className="flex gap-3 items-center">
					<span className="font-semibold text-2xl">
						{format(new Date(game.datetime), "HH:mm")}
					</span>
					{isLive && (
						<span className="bg-red-500 text-white text-xl px-4 py-1 rounded-full">
							LIVE
						</span>
					)}
				</div>
				<div className="mt-1 text-xl text-gray-500">
					{game.competition} {/* - Poule {game.poule} */}
				</div>
			</div>

			<div className="flex justify-between items-center w-full gap-x-4">
				<div className="flex-1">
					<div className="flex items-center space-x-4">
						{game.home_team.logo && (
							<img
								src={game.home_team.logo}
								alt={game.home_team.club_name}
								className="w-10 h-10 object-contain"
							/>
						)}
						<span className="font-medium text-2xl">{game.home_team.name}</span>
					</div>
				</div>
				
				<div className="mx-2 font-medium text-center min-w-[60px] text-xl">
					{game.home_score !== null ? `${game.home_score} - ${game.away_score}` : "vs"}
				</div>
				
				<div className="flex-1 flex justify-end">
					<div className="flex items-center space-x-4">
						<span className="font-medium text-right text-2xl">{game.away_team.name}</span>
						{game.away_team.logo && (
							<img
								src={game.away_team.logo}
								alt={game.away_team.club_name}
								className="w-10 h-10 object-contain"
							/>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default function HockeyGames() {
	const [games, setGames] = useState([]);
	const [loading, setLoading] = useState(false);
	const [currentTime, setCurrentTime] = useState(format(new Date(), "HH:mm"));

	async function fetchGames() {
		setLoading(true);
		try {
			const response = await fetch("/api/games");
			if (!response.ok) {
				throw new Error(`Failed to fetch games: ${response.status}`);
			}
			const data = await response.json();
			setGames(Array.isArray(data?.domeGames) ? data.domeGames : []);
		} catch (error) {
			console.error("Error fetching games:", error);
			setGames([]);
		}
		setLoading(false);
	}

	useEffect(() => {
		const initialFetch = setTimeout(fetchGames, 0);
		const interval = setInterval(fetchGames, 120000); // Refresh every 2 minutes
		return () => {
			clearTimeout(initialFetch);
			clearInterval(interval);
		};
	}, []);

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentTime(format(new Date(), "HH:mm"));
		}, 1000);

		return () => clearInterval(interval);
	}, []);

	const hasFieldAssignments = games.some(
		(game) => typeof game.field === "string" && game.field.trim().length > 0
	);
	const gamesInDisplayOrder = [...games].sort(
		(left, right) => new Date(left.datetime) - new Date(right.datetime)
	);
	const fieldAGames = games.filter((game) => game.field === "Veld A");
	const fieldBGames = games.filter((game) => game.field === "Veld B");
	const fallbackLeftColumnGames = gamesInDisplayOrder.filter((_, index) => index % 2 === 0);
	const fallbackRightColumnGames = gamesInDisplayOrder.filter((_, index) => index % 2 === 1);

	return (
		<ScaledWrapper>
			<div className="px-4 py-4">
				<div className="flex items-center justify-between mb-6">
					<div className="flex gap-3 items-center text-4xl font-semibold">
						<ArrowLeft className="w-12 h-12" />
						{hasFieldAssignments ? "Veld B" : "Wedstrijden"}
					</div>

					<div className="flex items-center gap-5">
						<img src="cartouche.png" className="w-20 h-20" alt="Cartouche logo" />
						<div>
							<h1 className="text-4xl font-semibold mb-1">Cartouche Game Center</h1>
							<div className="flex items-center gap-5">
								<h3 className="text-3xl text-gray-500">
									{format(new Date(), "EEEE d MMMM").substring(0, 1).toUpperCase() + format(new Date(), "EEEE d MMMM").substring(1)}
								</h3>
								<h3 className="text-3xl text-gray-500 flex gap-1 items-center">
									<Clock className="w-8 h-8" /> {currentTime}
								</h3>
							</div>
						</div>
					</div>

					<img
						src="qr.png"
						alt="QR-code"
						className="w-20 h-20"
					/>

					<div className="flex gap-3 items-center text-4xl font-semibold">
						{hasFieldAssignments ? (
							<>
								Veld A <ArrowRight className="w-12 h-12" />
							</>
						) : (
							<span className="text-2xl text-gray-400">Nieuwe API zonder veldnamen</span>
						)}
					</div>
				</div>


				{/* {
					loading && (
						<h3 className="absolute left-4 top-4 text-sm text-gray-500 flex gap-1 items-center">
							<Loader className="w-4 h-4 inline-block" /> Verversen...
						</h3>
					)
				} */}
				
				{!hasFieldAssignments && gamesInDisplayOrder.length > 0 ? (
					<div className="grid grid-cols-2 gap-x-12">
						<div className="flex flex-col gap-y-3">
							{fallbackLeftColumnGames.map((game) => (
								<GameCard key={game.id} game={game} />
							))}
						</div>

						<div className="flex flex-col gap-y-3">
							{fallbackRightColumnGames.map((game) => (
								<GameCard key={game.id} game={game} />
							))}
						</div>
					</div>
				) : fieldAGames.length === 0 && fieldBGames.length === 0 ? (
						<div className="py-32">
							<Image src="/stick.png" alt="Stick" width={40} height={40} className="mx-auto mb-4" />
							<div className="text-center text-2xl">
								Vandaag zijn er geen wedstrijden.
							</div>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-x-12">
							<div className="flex flex-col gap-y-3">
								{fieldBGames.map((game) => (
									<GameCard key={game.id} game={game} />
								))}
							</div>
							
							<div className="flex flex-col gap-y-3">
								{fieldAGames.map((game) => (
									<GameCard key={game.id} game={game} />
								))}
							</div>
						</div>
					)}
			</div>
		</ScaledWrapper>
	);
}
