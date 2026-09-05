/** Original ONI clan mark — abstract oni horns over a torii-like bar. */
export function OniMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      className={className}
      role="presentation"
    >
      <path
        d="M8 16C8 16 10.5 6 14 6c2.6 0 3.4 4.2 3.6 7.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M40 16C40 16 37.5 6 34 6c-2.6 0-3.4 4.2-3.6 7.2"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M6 18h36" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M11 24h26l-4.5 12L24 43l-8.5-7L11 24Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M19 29.5h4M25 29.5h4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
