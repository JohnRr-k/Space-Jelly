import { nav, person } from '@/content/site';

export default function Footer() {
  return (
    <footer className="footer dark">
      <div className="wrap footer-in">
        <p className="footer-name">
          {person.name}, <span>{person.designation}</span>
        </p>
        <nav aria-label="Footer">
          <ul>
            {nav.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`}>{n.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="footer-fine">
          © 2026 {person.name}. All rights reserved. <a href="#home">Back to top ↑</a>
        </p>
      </div>
    </footer>
  );
}
