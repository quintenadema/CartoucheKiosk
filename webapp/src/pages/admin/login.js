export default function LegacyAdminLoginRoute() {
	return null;
}

export function getServerSideProps() {
	return { redirect: { destination: "/login", permanent: false } };
}
