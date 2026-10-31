import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/dm-sans/index.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./globals.css";
import AppShell from "@/components/AppShell";
import Aurora from "@/components/Aurora";
import { site } from "@/lib/site";

const title = "Juvenn Elkins Ravelliyo | Brand Strategy Portfolio";
const description =
  "Research-led brand strategy, content and outreach. Selected work from a national AR packaging competition, new-business pitches and student-led events, including a webinar that drove 626 registrations.";

export const metadata: Metadata = {
  metadataBase: site.url ? new URL(site.url) : undefined,
  title: { default: title, template: "%s | Juvenn Elkins Ravelliyo" },
  description,
  applicationName: "Juvenn Elkins Ravelliyo Portfolio",
  authors: [{ name: site.name, url: site.linkedin }],
  openGraph: {
    type: "website",
    title,
    description,
    siteName: "Juvenn Elkins Ravelliyo",
    ...(site.url ? { images: [{ url: "/og.png", width: 1200, height: 630, alt: "Juvenn Elkins Ravelliyo, brand strategy portfolio" }] } : {}),
  },
  twitter: { card: "summary_large_image", title, description, ...(site.url ? { images: ["/og.png"] } : {}) },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#050d16",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <noscript>
          <style>{`.jer-cover{display:none!important}`}</style>
        </noscript>
        <Aurora />
        <a href="#main" className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 focus:translate-y-0">
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
