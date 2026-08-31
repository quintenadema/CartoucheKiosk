import Image from "next/image";
import Link from "next/link";
import { CalendarRange, LayoutGrid, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const navigationItems = [
	{
		id: "sponsors",
		label: "Sponsoren",
		href: "/beheer/sponsoren",
		icon: LayoutGrid,
	},
	{
		id: "training-schedule",
		label: "Trainingsschema",
		href: "/beheer/trainingsschema",
		icon: CalendarRange,
	},
];

export default function AdminShell({ activeItem, children }) {
	async function signOut() {
		await authClient.signOut();
		window.location.assign("/login");
	}

	return (
		<div className="min-h-screen bg-[#ede9de] text-[#10261a] lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
			<aside className="relative z-20 border-b border-white/10 bg-[#082c1b] text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
				<div className="flex items-center justify-between gap-5 px-5 py-4 sm:px-8 lg:block lg:px-6 lg:py-7">
					<Link href="/beheer/sponsoren" className="flex items-center gap-3">
						<span className="rounded-xl bg-white p-2 shadow-lg shadow-black/15">
							<Image src="/cartouche.png" alt="Cartouche" width={38} height={38} priority />
						</span>
						<span>
							<span className="block text-[10px] font-bold uppercase tracking-[0.24em] text-[#f4c542]">HC Cartouche</span>
							<span className="mt-1 block font-semibold">Narrowcasting beheer</span>
						</span>
					</Link>

					<button
						onClick={signOut}
						className="rounded-xl border border-white/15 p-2.5 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
						aria-label="Uitloggen"
					>
						<LogOut className="h-5 w-5" />
					</button>
				</div>

				<nav className="flex gap-2 overflow-x-auto px-5 pb-4 sm:px-8 lg:mt-4 lg:block lg:space-y-2 lg:overflow-visible lg:px-4 lg:pb-0">
					{navigationItems.map((item) => {
						const Icon = item.icon;
						const active = activeItem === item.id;

						return (
							<Link
								key={item.id}
								href={item.href}
								aria-current={active ? "page" : undefined}
								className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
									active
										? "bg-white text-[#082c1b] shadow-lg shadow-black/10"
										: "text-white/68 hover:bg-white/10 hover:text-white"
								}`}
							>
								<Icon className="h-[18px] w-[18px]" />
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div className="mt-auto hidden border-t border-white/10 p-4 lg:block">
					<div className="mb-4 px-3">
						<p className="text-sm font-semibold">Clubbeheer</p>
						<p className="mt-1 text-xs text-white/45">Gedeelde toegang</p>
					</div>
					<button
						onClick={signOut}
						className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/65 transition hover:bg-white/10 hover:text-white"
					>
						<LogOut className="h-4 w-4" />
						Uitloggen
					</button>
				</div>
			</aside>

			<div className="min-w-0">{children}</div>
		</div>
	);
}
