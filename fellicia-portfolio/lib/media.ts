export const PUBLIC_MODE = process.env.NEXT_PUBLIC_PUBLIC_MODE === 'true';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const media = (path: string) => `/media/${path}`;

/** A figure flagged `restricted` is client-related and is withheld in the public edition. */
export const isShown = (f: { restricted?: boolean }) => !(PUBLIC_MODE && f.restricted);
