'use client';

import { useRef, useState } from 'react';
import { nav, person } from '@/content/site';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);

  const openMenu = () => {
    dlg.current?.showModal();
    setOpen(true);
  };
  const closeMenu = () => {
    dlg.current?.close();
  };

  return (
    <>
      <header className="nav">
        <a className="nav-mono" href="#home" aria-label={`${person.name}, back to top`}>
          <span>FAK</span>
        </a>
        <nav aria-label="Primary" className="nav-links">
          <ul>
            {nav.map((n) => (
              <li key={n.id}>
                <a href={`#${n.id}`} data-nav={n.id}>
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="nav-menu-btn" onClick={openMenu} aria-haspopup="dialog" aria-expanded={open}>
          <span className="bars" aria-hidden="true" />
          Menu
        </button>
      </header>

      <dialog
        ref={dlg}
        className="menu"
        aria-label="Site menu"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dlg.current) closeMenu();
        }}
      >
        <div className="menu-inner">
          <button type="button" className="menu-close" onClick={closeMenu}>
            Close
          </button>
          <nav aria-label="Mobile">
            <ol>
              {nav.map((n, i) => (
                <li key={n.id} style={{ '--i': i } as React.CSSProperties}>
                  <a href={`#${n.id}`} data-nav={n.id} onClick={closeMenu}>
                    <span className="menu-n">{String(i + 1).padStart(2, '0')}</span>
                    {n.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <p className="menu-foot">
            {person.name}, {person.designation}
            <br />
            <a href={`mailto:${person.email}`}>{person.email}</a>
          </p>
        </div>
      </dialog>
    </>
  );
}
