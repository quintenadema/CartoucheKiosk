export { default } from "@/pages/index";

export async function getServerSideProps(context) {
	const [{ getAdminSession }, { listSponsors }, { getSponsorSyncSettings }] = await Promise.all([
		import("@/lib/admin-auth"),
		import("@/lib/sponsors"),
		import("@/lib/sponsor-sync"),
	]);
	const session = await getAdminSession(context.req);

	if (!session) {
		return { redirect: { destination: "/login", permanent: false } };
	}

	const [sponsors, syncSettings] = await Promise.all([
		listSponsors({ includeInactive: true }),
		getSponsorSyncSettings(),
	]);
	return {
		props: {
			initialSponsors: JSON.parse(JSON.stringify(sponsors)),
			initialSyncSettings: JSON.parse(JSON.stringify(syncSettings)),
		},
	};
}
