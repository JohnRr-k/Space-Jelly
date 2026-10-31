import type { Metadata, Viewport } from 'next';
import '@fontsource/cormorant-garamond/300.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/300-italic.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource-variable/manrope/index.css';
import './globals.css';
import { PUBLIC_MODE, SITE_URL } from '@/lib/media';
import { person } from '@/content/site';

const title = `${person.name}, ${person.designation} | Legal Professional Portfolio`;
const description =
  'Portfolio of Fellicia Angelica Kholim, S.H., CLA., Junior Associate at FRP Law Firm, with experience in corporate law, regulatory compliance, legal advisory, and dispute resolution.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  applicationName: `${person.name} Portfolio`,
  authors: [{ name: person.name }],
  // The private edition is never indexed. Only PUBLIC_MODE builds are indexable.
  robots: PUBLIC_MODE ? { index: true, follow: true } : { index: false, follow: false },
  openGraph: {
    type: 'profile',
    title,
    description,
    siteName: `${person.name} Portfolio`,
    images: [{ url: '/og.png', width: 1200, height: 630, alt: `${person.name}, ${person.designation}` }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
};

export const viewport: Viewport = {
  themeColor: '#141416',
  colorScheme: 'dark light',
};

// Runs before first paint: marks JS availability and decides whether the opening sequence plays.
const bootScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var r=matchMedia('(prefers-reduced-motion: reduce)').matches;d.dataset.intro=(r||sessionStorage.getItem('fak-intro'))?'seen':'play'}catch(e){d.dataset.intro='seen'}setTimeout(function(){if(!window.__fx)d.classList.add('fx-fail')},4500)})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
