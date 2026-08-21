export default function LegacyAdminRoute() {
	return null;
}

export function getServerSideProps() {
	return { redirect: { destination: "/", permanent: false } };
}
