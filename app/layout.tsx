import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Nav } from "@/components/nav";
import { ServiceWorker } from "@/components/service-worker";
import { APP_NAME, TAGLINE } from "@/lib/config";
import { getViewer } from "@/lib/session";
import "./globals.css";

// next/font downloads these at build time and serves them from this app:
// no runtime font CDN. Both are SIL OFL 1.1 (see public/fonts/LICENSES.md).
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", weight: "variable" });
const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} · ${TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: "Find a student from your college making the same journey home.",
  applicationName: APP_NAME,
};

export const viewport: Viewport = { themeColor: "#faf7f0", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  const signedIn = !!viewer && viewer !== "orphan";
  return (
    <html lang="en-IN" className={`${bricolage.variable} ${instrument.variable}`}>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:sheet focus:p-3">
          Skip to content
        </a>
        <Nav signedIn={signedIn} isAdmin={signedIn && viewer.isAdmin} />
        {signedIn && viewer.college.status === "requested" && (
          <p role="status" className="border-b border-line bg-raised px-4 py-3 text-center text-small">
            We haven&apos;t verified <strong>{viewer.college.name}</strong> as a college yet and will as soon as possible. You can use{" "}
            {APP_NAME} meanwhile, matching only with students from the same email domain.
          </p>
        )}
        {signedIn && viewer.college.status === "rejected" && (
          <p role="status" className="border-b border-line bg-raised px-4 py-3 text-center text-small text-warn">
            We couldn&apos;t verify {viewer.college.name} as a college, so this account can&apos;t post, connect or chat.
          </p>
        )}
        {signedIn && viewer.suspended && (
          <p role="status" className="border-b border-line bg-raised px-4 py-3 text-center text-small text-warn">
            Your account is suspended while a moderator reviews reports. You can&apos;t post, connect or chat until then.
          </p>
        )}
        <main id="main" className="mx-auto w-full max-w-[1120px] px-4 pb-28 pt-6 md:pb-16 md:pt-10">
          {children}
        </main>
        <ServiceWorker />
      </body>
    </html>
  );
}
