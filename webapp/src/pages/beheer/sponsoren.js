export { default } from "@/pages/index";

export async function getServerSideProps(context) {
	const [{ getAdminSession }, { listSponsors }] = await Promise.all([
		import("@/lib/admin-auth"),
		import("@/lib/sponsors"),
	]);
	const session = await getAdminSession(context.req);

	if (!session) {
		return { redirect: { destination: "/login", permanent: false } };
	}

	const sponsors = await listSponsors({ includeInactive: true });
	return {
		props: {
			initialSponsors: JSON.parse(JSON.stringify(sponsors)),
		},
	};
}
