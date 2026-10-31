declare global {
  interface Window {
    /** Present only in the single-file edition: media path -> data URI. */
    __M?: Record<string, string>;
  }
}

export const PUBLIC_MODE = process.env.NEXT_PUBLIC_PUBLIC_MODE === 'true';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const media = (path: string) =>
  (typeof window !== 'undefined' && window.__M?.[path]) || `/media/${path}`;

/** A figure flagged `restricted` is client-related and is withheld in the public edition. */
export const isShown = (f: { restricted?: boolean }) => !(PUBLIC_MODE && f.restricted);
