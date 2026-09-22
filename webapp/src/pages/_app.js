import "@/styles/globals.css";
import { Roboto_Condensed } from "next/font/google";
import Script from "next/script";
import { useEffect } from "react";
import { useRouter } from "next/router";
import { startDeploymentRefresh } from "@/lib/deployment-refresh";

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  display: "swap",
});

export default function App({ Component, pageProps }) {
  const { pathname } = useRouter();
  useEffect(() => {
    if (pathname !== "/outdoor" || process.env.NODE_ENV !== "production") return;
    return startDeploymentRefresh({
      currentVersion: process.env.NEXT_PUBLIC_DEPLOYMENT_VERSION,
      fetchVersion: (...args) => window.fetch(...args),
      reload: () => window.location.reload(),
    });
  }, [pathname]);
  return (
    <>
      <div className={robotoCondensed.className}>
        <Component {...pageProps} />
      </div>
      <Script
        src="https://analytics.ademagroup.com/insights.js"
        strategy="afterInteractive"
        data-website-id="29564159-f44f-4e85-b655-d8c79f553ba0"
        data-domains="cartouche-kiosk.vercel.app"
        data-exclude-search="true"
        data-exclude-hash="true"
        data-do-not-track="true"
        data-performance="true"
      />
    </>
  );
}
