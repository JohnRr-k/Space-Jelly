const words = ['Corporate Law', 'Regulatory Compliance', 'Legal Advisory', 'Corporate Governance', 'Dispute Resolution'];

export default function Ticker() {
  const run = (hidden: boolean) => (
    <ul className="ticker-run" aria-hidden={hidden || undefined}>
      {words.map((w) => (
        <li key={w}>
          {w}
          <i aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
  return (
    <div className="ticker" aria-label="Areas of professional experience">
      <div className="ticker-track">
        {run(false)}
        {run(true)}
        {run(true)}
      </div>
    </div>
  );
}
