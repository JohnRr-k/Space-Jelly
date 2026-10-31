import { certs } from '@/content/site';
import { media } from '@/lib/media';

/** Two rows of the real certificates running in opposite directions, plus a scroll-driven outlined strip. */
export default function AssetBand() {
  const rowA = certs.filter((_, i) => i % 2 === 0);
  const rowB = certs.filter((_, i) => i % 2 === 1);
  const run = (list: typeof certs, hidden: boolean) => (
    <ul className="band-run" aria-hidden={hidden || undefined}>
      {list.map((c, i) => (
        <li key={c.id + i} style={{ '--r': `${i % 2 ? -2.2 : 2.2}deg` } as React.CSSProperties}>
          <img src={media(`${c.file}-thumb.webp`)} width={480} height={Math.round((480 * c.h) / c.w)} alt="" loading="lazy" decoding="async" />
        </li>
      ))}
    </ul>
  );
  return (
    <section className="band dark" aria-label="Selected certificates" data-section="expertise" data-label="Expertise">
      <p className="band-strip" aria-hidden="true">
        <span data-drift="-0.35">Corporate Law — Regulatory Compliance — Legal Advisory — Dispute Resolution — Corporate Governance —</span>
      </p>
      <div className="band-row">
        <div className="band-track slow">
          {run(rowA, false)}
          {run(rowA, true)}
          {run(rowA, true)}
        </div>
      </div>
      <div className="band-row">
        <div className="band-track fast reverse">
          {run(rowB, true)}
          {run(rowB, true)}
          {run(rowB, true)}
        </div>
      </div>
    </section>
  );
}
