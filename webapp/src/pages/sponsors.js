import Head from "next/head";
import { useEffect, useState } from "react";

function SponsorTrack({ sponsors, durationInSeconds, reverse = false }) {
	const marqueeSponsors = [...sponsors, ...sponsors];

	return (
		<div className="overflow-hidden py-4">
			<div
				className="flex w-max items-stretch gap-8 will-change-transform"
				style={{
					animation: `${reverse ? "sponsor-marquee-reverse" : "sponsor-marquee"} ${durationInSeconds}s linear infinite`,
				}}
			>
				{marqueeSponsors.map((sponsor, index) => (
					<div
						key={`${sponsor.name}-${index}`}
						className="flex min-h-[240px] w-[360px] shrink-0 flex-col justify-between rounded-[2rem] border border-white/10 bg-white p-8 text-slate-900 shadow-2xl shadow-black/20"
					>
						<div className="flex h-[140px] items-center justify-center">
							<img
								src={sponsor.image}
								alt={sponsor.name}
								className="max-h-[120px] w-full object-contain"
								decoding="async"
								loading="eager"
							/>
						</div>
						<div className="mt-6 text-center text-2xl font-semibold tracking-wide text-slate-700">
							{sponsor.name}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function SponsorsPage() {
	const [sponsors, setSponsors] = useState([]);
	const [loading, setLoading] = useState(true);
	const [hasError, setHasError] = useState(false);

	useEffect(() => {
		let isActive = true;

		const fetchSponsors = async () => {
			try {
				const response = await fetch("/api/sponsors");

				if (!response.ok) {
					throw new Error(`Failed to fetch sponsors: ${response.status}`);
				}

				const data = await response.json();

				if (!isActive) {
					return;
				}

				setSponsors(Array.isArray(data?.sponsors) ? data.sponsors : []);
				setHasError(false);
			} catch (error) {
				console.error("Failed to load sponsors", error);

				if (!isActive) {
					return;
				}

				setSponsors([]);
				setHasError(true);
			} finally {
				if (isActive) {
					setLoading(false);
				}
			}
		};

		fetchSponsors();
		const interval = setInterval(fetchSponsors, 15 * 60 * 1000);

		return () => {
			isActive = false;
			clearInterval(interval);
		};
	}, []);

	const upperRowSponsors = sponsors.filter((_, index) => index % 2 === 0);
	const lowerRowSponsors = sponsors.filter((_, index) => index % 2 === 1);
	const sponsorRows =
		lowerRowSponsors.length > 0 ? [upperRowSponsors, lowerRowSponsors] : [upperRowSponsors];

	return (
		<>
			<Head>
				<title>Cartouche Partners</title>
				<meta
					name="viewport"
					content="width=device-width, initial-scale=1, viewport-fit=cover"
				/>
			</Head>

			<div className="relative min-h-screen overflow-hidden bg-[#041d11] text-white">
				<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(91,191,104,0.28),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(255,204,76,0.18),_transparent_30%),linear-gradient(135deg,_#052614_0%,_#03130b_60%,_#010907_100%)]" />
				<div className="absolute left-[-12rem] top-[18%] h-96 w-96 rounded-full bg-white/5 blur-3xl" />
				<div className="absolute bottom-[-10rem] right-[-8rem] h-80 w-80 rounded-full bg-[#f4c542]/10 blur-3xl" />

				<div className="relative flex min-h-screen flex-col justify-center">
					
					<h1 className="mt-5 mx-auto text-5xl font-semibold text-center tracking-[0.08em] lg:text-7xl">
						Onze Sponsoren
					</h1>

					<p className="mt-5 mx-auto mb-12 max-w-4xl text-center text-xl leading-relaxed text-white/75 lg:text-2xl">
						We zijn trots op onze samenwerking met deze geweldige sponsoren die ons
						ondersteunen bij het realiseren van een onvergetelijke ervaring voor onze bezoekers.
					</p>

					{loading ? (
						<div className="py-24 text-center text-3xl text-white/70">
							Sponsoren laden...
						</div>
					) : hasError ? (
						<div className="py-24 text-center text-3xl text-white/70">
							De sponsoren konden niet worden geladen.
						</div>
					) : sponsors.length === 0 ? (
						<div className="py-24 text-center text-3xl text-white/70">
							Er zijn geen sponsoren gevonden.
						</div>
					) : (
						<div className="space-y-8">
							{sponsorRows.map((rowSponsors, index) => (
								<SponsorTrack
									key={`row-${index}`}
									sponsors={rowSponsors}
									durationInSeconds={Math.max(rowSponsors.length * 10, 90)}
									reverse={index % 2 === 1}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			<style jsx global>{`
				@keyframes sponsor-marquee {
					from {
						transform: translateX(0);
					}

					to {
						transform: translateX(-50%);
					}
				}

				@keyframes sponsor-marquee-reverse {
					from {
						transform: translateX(-50%);
					}

					to {
						transform: translateX(0);
					}
				}
			`}</style>
		</>
	);
}
