/* 이모지 아이콘 금지(ui-ux-pro-max 체크리스트) — Lucide 계열 인라인 SVG, stroke=currentColor */

function Base({
  children,
  className = "size-4",
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export const IconThread = (p: { className?: string }) => (
  <Base {...p}>
    <path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2z" />
    <path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" />
  </Base>
);

export const IconNetwork = (p: { className?: string }) => (
  <Base {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2" />
  </Base>
);

export const IconPin = (p: { className?: string }) => (
  <Base {...p}>
    <path d="M12 17v5" />
    <path d="M9 10.8V6a3 3 0 0 1 6 0v4.8l2.7 3.2a1 1 0 0 1-.8 1.6H7.1a1 1 0 0 1-.8-1.6z" />
  </Base>
);

export const IconTag = (p: { className?: string }) => (
  <Base {...p}>
    <path d="M12.6 2.9a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2c0 .5.2 1 .6 1.4l8.6 8.6a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8z" />
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const IconFilm = (p: { className?: string }) => (
  <Base {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="M7 4v16M17 4v16M2 9h5M2 15h5M17 9h5M17 15h5" />
  </Base>
);

export const IconInfo = (p: { className?: string }) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Base>
);

export const IconAlert = (p: { className?: string }) => (
  <Base {...p}>
    <path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3" />
    <path d="M12 9v4M12 17h.01" />
  </Base>
);

export const IconPlay = (p: { className?: string }) => (
  <Base {...p}>
    <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none" />
  </Base>
);
