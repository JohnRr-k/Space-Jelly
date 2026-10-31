// Static export: the site can be hosted on any static host (Vercel, Netlify, S3, GitHub Pages…).
// PUBLIC_MODE=true builds the public edition: client-related visuals flagged `restricted`
// are excluded from the output entirely and the site is marked indexable.
const publicMode = process.env.PUBLIC_MODE === 'true';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true }, // assets are pre-optimised WebP (see scripts/build-assets.py)
  env: {
    NEXT_PUBLIC_PUBLIC_MODE: publicMode ? 'true' : 'false',
    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL ?? 'http://localhost:3000',
  },
};
export default nextConfig;
