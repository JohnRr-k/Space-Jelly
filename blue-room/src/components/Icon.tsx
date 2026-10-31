import type { ReactNode, SVGProps } from 'react';

/** A small hand-drawn icon set. 24×24, 1.7 stroke, rounded. Marine motifs for the main places. */
const P: Record<string, ReactNode> = {
  // ----- places
  room: <><path d="M3 20h18" /><path d="M4 20v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" /><path d="M6 12V9a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3" /><path d="M4 16h16" /><path d="M17 5.2c.9-1 2.6-1 3.3.4" /></>,
  journal: <><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H18v15.5H6.5A1.5 1.5 0 0 0 5 20z" /><path d="M5 20a1.5 1.5 0 0 0 1.5 1.5H18" /><path d="M9 8h5M9 11.5h4" /></>,
  legacy: <><path d="M12 3c-4.6 0-8 3.2-8 7.5 0 3.6 2.2 6.3 5 7.5l-.5 2.5h7l-.5-2.5c2.8-1.2 5-3.9 5-7.5C20 6.200 16.600 3 12 3z" /><path d="M12 3v15M8 5.500c-.8 2-.8 6.500 1.500 12M16 5.500c.8 2 .8 6.500-1.500 12" /></>,
  oracle: <><circle cx="12" cy="11" r="6.500" /><path d="M8.800 9.200a4 4 0 0 1 2.600-1.800" /><path d="M7 20h10M9 17.500 8 20M15 17.500l1 2.500" /></>,
  goal: <><circle cx="12" cy="12" r="8.500" /><path d="m15.500 8.500-2 5-5 2 2-5z" /></>,
  compass: <><circle cx="12" cy="12" r="8.500" /><path d="m15.500 8.500-2 5-5 2 2-5z" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></>,
  calendar: <><rect x="3.500" y="5" width="17" height="15.500" rx="3" /><path d="M3.500 10h17M8 3v4M16 3v4" /><path d="M8 14h2M12 14h2M8 17h2" /></>,
  note: <><path d="M5 4h14v11l-5 5H5z" /><path d="M14 20v-4a1 1 0 0 1 1-1h4" /><path d="M8.500 9h7M8.500 12.500h4" /></>,
  settings: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  search: <><circle cx="11" cy="11" r="6.500" /><path d="m16 16 4.500 4.500" /></>,
  bell: <><path d="M6 17V11a6 6 0 0 1 12 0v6l1.500 2h-15z" /><path d="M10 21.500h4" /></>,
  sound: <><path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z" /><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11" /></>,
  soundOff: <><path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z" /><path d="m16 9.500 5 5M21 9.500l-5 5" /></>,
  // ----- legacy parts
  timeline: <><path d="M12 3v18" /><circle cx="12" cy="7" r="2.200" /><circle cx="12" cy="17" r="2.200" /><path d="M14.500 7H20M3.500 17H9.500" /></>,
  chapter: <><path d="M4 5.500C4 4.600 4.700 4 5.500 4H11v16H5.500C4.700 20 4 19.400 4 18.500z" /><path d="M13 4h5.500c.8 0 1.500.6 1.500 1.500v13c0 .9-.7 1.500-1.500 1.500H13z" /><path d="M7 8h2M15.500 8H17" /></>,
  memory: <><rect x="3.500" y="5" width="17" height="14" rx="3" /><circle cx="9" cy="10.500" r="1.800" /><path d="m4 17 4.500-4 3.500 3 3-2.500 5 4" /></>,
  people: <><circle cx="9" cy="8.500" r="3.200" /><path d="M3.500 19.500c.4-3.200 2.600-5 5.500-5s5.100 1.800 5.500 5" /><circle cx="17" cy="9.500" r="2.400" /><path d="M16.500 14.600c2.200.1 3.700 1.600 4 4.400" /></>,
  place: <><path d="M12 21c-4-4.500-6.500-7.500-6.500-11a6.500 6.500 0 0 1 13 0c0 3.500-2.500 6.500-6.500 11z" /><circle cx="12" cy="10" r="2.300" /></>,
  lesson: <><path d="M9 17.500h6M10 20.500h4" /><path d="M8.200 14.500C6.800 13.400 6 11.800 6 10a6 6 0 0 1 12 0c0 1.800-.8 3.400-2.200 4.500-.5.400-.8 1-.8 1.600V17.500H9v-1.400c0-.6-.3-1.200-.8-1.600z" /></>,
  letter: <><rect x="3" y="5.500" width="18" height="13" rx="3" /><path d="m4 8 8 5.500L20 8" /></>,
  pearl: <><circle cx="12" cy="13" r="6.500" /><path d="M9 10.500a4 4 0 0 1 3-1.500" /><path d="M8 4.500 12 3l4 1.500" /></>,
  wisdom: <><path d="m12 3.500 2.200 5 5.300.5-4 3.600 1.200 5.300L12 15.100 7.300 17.900l1.200-5.300-4-3.600 5.300-.5z" /></>,
  // ----- marine
  jellyfish: <><path d="M5 12.500a7 7 0 0 1 14 0c0 .8-.6 1.300-1.300 1.300H6.300C5.600 13.800 5 13.300 5 12.500z" /><path d="M8 14.500c-.6 2 .6 3 0 5M12 14c0 2.500-.6 3.500.2 6M16 14.500c.6 2-.5 3 .1 5" /></>,
  fish: <><path d="M3 12c3-4.500 8-5.500 12-3.500l3.500-2.500v12L15 15.500C11 17.500 6 16.500 3 12z" /><circle cx="8" cy="11" r=".8" fill="currentColor" /></>,
  shell: <><path d="M12 20c-4.500 0-8-2.800-8-7 0-4 3.500-7 8-9 4.500 2 8 5 8 9 0 4.200-3.500 7-8 7z" /><path d="M12 4v16M8 6.500c-1.500 4-1.500 8.500 1.500 13M16 6.500c1.500 4 1.500 8.500-1.500 13" /></>,
  wave: <><path d="M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0" /></>,
  anchor: <><circle cx="12" cy="5" r="2" /><path d="M12 7v14M5 13c0 4 3 7 7 7s7-3 7-7M3 13h4M17 13h4" /></>,
  bubbles: <><circle cx="8" cy="15" r="4.500" /><circle cx="16.500" cy="8" r="3" /><circle cx="17" cy="17" r="1.500" /></>,
  // ----- generic
  plus: <><path d="M12 5v14M5 12h14" /></>,
  x: <><path d="m6 6 12 12M18 6 6 18" /></>,
  check: <><path d="m5 12.500 4.500 4.500L19 7.500" /></>,
  edit: <><path d="M4 20h4L19 9a2.800 2.800 0 0 0-4-4L4 16z" /><path d="m13.500 6.500 4 4" /></>,
  trash: <><path d="M4.500 7h15M9.500 7V4.500h5V7M6.500 7l.8 12a1.500 1.500 0 0 0 1.500 1.400h6.400a1.500 1.500 0 0 0 1.500-1.400l.8-12M10 11v6M14 11v6" /></>,
  chevL: <><path d="m14.500 6-6 6 6 6" /></>,
  chevR: <><path d="m9.500 6 6 6-6 6" /></>,
  chevD: <><path d="m6 9.500 6 6 6-6" /></>,
  chevU: <><path d="m6 14.500 6-6 6 6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  more: <><circle cx="5.500" cy="12" r="1.300" fill="currentColor" /><circle cx="12" cy="12" r="1.300" fill="currentColor" /><circle cx="18.500" cy="12" r="1.300" fill="currentColor" /></>,
  tag: <><path d="M4 12.500V5a1 1 0 0 1 1-1h7.500l7.500 7.500a1.500 1.500 0 0 1 0 2.100l-5.900 5.900a1.500 1.500 0 0 1-2.100 0z" /><circle cx="8.500" cy="8.500" r="1.200" fill="currentColor" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1" /><path d="M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1" /></>,
  image: <><rect x="3.500" y="4.500" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.700" /><path d="m4 17 5-4.500 3.500 3 3-2.500 4.500 4" /></>,
  clock: <><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></>,
  pin: <><path d="M9 4h6l-1 6 3 3H7l3-3z" /><path d="M12 13v7" /></>,
  download: <><path d="M12 4v11M7.500 11 12 15.500 16.500 11M5 20h14" /></>,
  upload: <><path d="M12 16V5M7.500 9 12 4.500 16.500 9M5 20h14" /></>,
  lock: <><rect x="5" y="10.500" width="14" height="10" rx="2.500" /><path d="M8 10.500V8a4 4 0 0 1 8 0v2.500" /></>,
  info: <><circle cx="12" cy="12" r="8.500" /><path d="M12 11v5.500M12 7.800v.2" /></>,
  warn: <><path d="M12 4 3 19.500h18z" /><path d="M12 10v4.500M12 17.200v.2" /></>,
  eye: <><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z" /><circle cx="12" cy="12" r="2.800" /></>,
  eyeOff: <><path d="M4 4l16 16M9.800 6a8.500 8.500 0 0 1 2.200-.5c6 0 9.500 6.500 9.500 6.500a15 15 0 0 1-2.600 3.300M6.300 7.700A15 15 0 0 0 2.500 12S6 18.500 12 18.500c1.300 0 2.500-.3 3.600-.8" /></>,
  sparkle: <><path d="M12 3c.5 4.500 2.500 6.500 7 7-4.500.5-6.500 2.500-7 7-.5-4.500-2.500-6.500-7-7 4.500-.5 6.500-2.500 7-7z" /></>,
  refresh: <><path d="M4.500 12a7.500 7.500 0 0 1 13-5M19.500 12a7.500 7.500 0 0 1-13 5" /><path d="M17.500 3v4h-4M6.500 21v-4h4" /></>,
  repeat: <><path d="M4 11V9.500A2.500 2.500 0 0 1 6.500 7H19l-3-3M20 13v1.500a2.500 2.500 0 0 1-2.500 2.500H5l3 3" /></>,
  list: <><path d="M9 6.500h11M9 12h11M9 17.500h11" /><circle cx="4.500" cy="6.500" r=".9" fill="currentColor" /><circle cx="4.500" cy="12" r=".9" fill="currentColor" /><circle cx="4.500" cy="17.500" r=".9" fill="currentColor" /></>,
  grid: <><rect x="4" y="4" width="6.500" height="6.500" rx="1.800" /><rect x="13.500" y="4" width="6.500" height="6.500" rx="1.800" /><rect x="4" y="13.500" width="6.500" height="6.500" rx="1.800" /><rect x="13.500" y="13.500" width="6.500" height="6.500" rx="1.800" /></>,
  bold: <><path d="M7 4.500h6a3.500 3.500 0 0 1 0 7H7zM7 11.500h7a3.500 3.500 0 0 1 0 7H7z" /></>,
  italic: <><path d="M10 4.500h8M6 19.500h8M14.500 4.500l-5 15" /></>,
  heading: <><path d="M6 5v14M18 5v14M6 12h12" /></>,
  quote: <><path d="M5 17.500c0-4 1.200-7.500 4.500-9.500M13.500 17.500c0-4 1.200-7.500 4.500-9.500" /><path d="M5 17.500h4.500V13H5zM13.500 17.500H18V13h-4.500z" /></>,
  bullets: <><path d="M9 6.500h11M9 12h11M9 17.500h11" /><circle cx="4.500" cy="6.500" r=".9" fill="currentColor" /><circle cx="4.500" cy="12" r=".9" fill="currentColor" /><circle cx="4.500" cy="17.500" r=".9" fill="currentColor" /></>,
  moon: <><path d="M20 14.500A8 8 0 0 1 9.500 4a8 8 0 1 0 10.500 10.500z" /></>,
  play: <><path d="m8 5.500 11 6.500-11 6.500z" /></>,
  undo: <><path d="M9 7 4.500 11.500 9 16" /><path d="M5 11.500h9a5 5 0 0 1 0 10h-3" transform="translate(0 -3)" /></>,
  swap: <><path d="M4 8h14l-3-3M20 16H6l3 3" /></>,
  flag: <><path d="M6 21V4M6 5h11l-2 4 2 4H6" /></>,
};

export type IconName = keyof typeof P;

export function Icon({ name, size, ...rest }: { name: string; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const body = P[name] ?? P.sparkle;
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...rest}
    >
      {body}
    </svg>
  );
}

/** A friendly little jellyfish used in empty states. */
export function JellyArt({ className = 'art' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="jg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.35" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <path d="M18 46c0-16 13-28 30-28s30 12 30 28c0 3-2.500 5-5.500 5h-49C20.500 51 18 49 18 46z" fill="url(#jg)" stroke="currentColor" strokeWidth="2.200" />
      <path d="M32 24c4-3 9-4.500 14-4" stroke="#fff" strokeWidth="2.600" strokeLinecap="round" opacity=".7" />
      <path d="M30 54c-2.500 7 2 10-.5 18M42 54c1 8-2 11 1 20M54 54c-1 8 2 11-1 20M66 54c2 7-2 10 .5 17" stroke="currentColor" strokeWidth="2.200" strokeLinecap="round" />
      <circle cx="76" cy="26" r="2.200" stroke="currentColor" strokeWidth="1.600" />
      <circle cx="82" cy="16" r="1.400" stroke="currentColor" strokeWidth="1.400" />
    </svg>
  );
}
