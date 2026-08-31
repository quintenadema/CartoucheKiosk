export default function LegacyAdminRoute() {
	return null;
}

export function getServerSideProps() {
	return { redirect: { destination: "/beheer/sponsoren", permanent: false } };
}
