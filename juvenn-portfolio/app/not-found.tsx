import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="tone-cover grid min-h-screen place-items-center px-[var(--gutter)] text-center">
      <div>
        <p className="mono text-peach-300">Error 404</p>
        <h1 className="display mt-4 text-[clamp(2.4rem,8vw,7rem)]">Page not found.</h1>
        <p className="mx-auto mt-4 max-w-md text-white/80">That page doesn&apos;t exist, but the work does.</p>
        <Link href="/" className="btn mt-8">Back to the portfolio <span className="arrow" aria-hidden>↗</span></Link>
      </div>
    </main>
  );
}
