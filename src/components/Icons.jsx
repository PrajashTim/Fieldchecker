import React from 'react';

/* Small stroke icon set (24px grid) so the UI has no external icon dependency. */
const Svg = ({ children, size = 18, className, strokeWidth = 2, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
    {...rest}
  >
    {children}
  </svg>
);

export const IconList = (p) => (
  <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></Svg>
);
export const IconMap = (p) => (
  <Svg {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></Svg>
);
export const IconLayers = (p) => (
  <Svg {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></Svg>
);
export const IconPin = (p) => (
  <Svg {...p}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></Svg>
);
export const IconNav = (p) => (
  <Svg {...p}><path d="m3 11 18-8-8 18-2-8-8-2Z" /></Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);
export const IconX = (p) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
);
export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>
);
export const IconSun = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);
export const IconMoon = (p) => (
  <Svg {...p}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" /></Svg>
);
export const IconStar = (p) => (
  <Svg {...p}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></Svg>
);
export const IconShield = (p) => (
  <Svg {...p}><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.2 7.5 9.5 4.3-1.3 7.5-4.9 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></Svg>
);
export const IconAlert = (p) => (
  <Svg {...p}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17.5v.01" /></Svg>
);
export const IconInfo = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.01" /></Svg>
);
export const IconChevron = (p) => (
  <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>
);
export const IconExternal = (p) => (
  <Svg {...p}><path d="M14 4h6v6M20 4l-9 9" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></Svg>
);
export const IconGrass = (p) => (
  <Svg {...p}><path d="M3 20h18" /><path d="M6 20c0-4 1-7 3-9M10 20c0-5 .5-9 2-12M14 20c0-4 1.5-7 4-8" /></Svg>
);
export const IconTarget = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></Svg>
);

/* Brand mark: a top-down pitch. */
export const LogoMark = ({ size = 30 }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <rect x="1" y="1" width="30" height="30" rx="9" fill="url(#lg)" />
    <rect x="7" y="9" width="18" height="14" rx="1.5" fill="none" stroke="#04160c" strokeWidth="1.6" />
    <path d="M16 9v14" stroke="#04160c" strokeWidth="1.6" />
    <circle cx="16" cy="16" r="2.6" fill="none" stroke="#04160c" strokeWidth="1.6" />
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
        <stop offset="0" stopColor="#a3f7bf" />
        <stop offset="1" stopColor="#22c55e" />
      </linearGradient>
    </defs>
  </svg>
);

/* Decorative pitch outline used behind the top-pick card. */
export const PitchArt = ({ className }) => (
  <svg className={className} viewBox="0 0 220 140" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="4" width="212" height="132" rx="4" />
    <path d="M110 4v132" />
    <circle cx="110" cy="70" r="20" />
    <circle cx="110" cy="70" r="2" fill="currentColor" />
    <rect x="4" y="34" width="32" height="72" />
    <rect x="4" y="52" width="12" height="36" />
    <rect x="184" y="34" width="32" height="72" />
    <rect x="204" y="52" width="12" height="36" />
  </svg>
);
