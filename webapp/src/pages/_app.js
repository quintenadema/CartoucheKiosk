import "@/styles/globals.css";
import { Roboto_Condensed } from "next/font/google";
import Script from "next/script";

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin"],
  display: "swap",
});

export default function App({ Component, pageProps }) {
  return (
    <>
      <div className={robotoCondensed.className}>
        <Component {...pageProps} />
      </div>
      <Script
        src="https://analytics.ademagroup.com/insights.js"
        strategy="afterInteractive"
        data-website-id="29564159-f44f-4e85-b655-d8c79f553ba0"
        data-domains="cartouche-dome.vercel.app,cartouche-dome-adema-group.vercel.app,cartouche-dome-git-main-adema-group.vercel.app"
        data-exclude-search="true"
        data-exclude-hash="true"
        data-do-not-track="true"
        data-performance="true"
      />
    </>
  );
}
