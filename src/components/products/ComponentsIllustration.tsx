/** Original decorative artwork; not a product photograph or wiring diagram. */
export function ComponentsIllustration() {
  return (
    <svg
      viewBox="0 0 560 320"
      fill="none"
      aria-hidden="true"
      className="h-auto w-full text-[var(--accent-strong)]"
    >
      <path
        d="M0 80H560M0 160H560M0 240H560M80 0V320M160 0V320M240 0V320M320 0V320M400 0V320M480 0V320"
        stroke="currentColor"
        opacity=".08"
      />
      <g transform="translate(55 45) rotate(-8 90 115)">
        <rect
          width="180"
          height="230"
          rx="18"
          fill="var(--accent-soft)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect x="45" y="55" width="90" height="90" rx="5" fill="var(--ink)" />
        <path
          d="M66 77H112V123H66ZM72 20V38H92V20H112V38H132M55 170H125M55 186H105"
          stroke="var(--surface-card)"
          strokeWidth="4"
        />
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i} fill="currentColor">
            <rect x="12" y={24 + i * 19} width="12" height="7" rx="2" />
            <rect x="156" y={24 + i * 19} width="12" height="7" rx="2" />
          </g>
        ))}
        <rect
          x="69"
          y="210"
          width="42"
          height="24"
          rx="4"
          fill="var(--ink-muted)"
        />
      </g>
      <g transform="translate(280 38) rotate(7 115 65)">
        <rect
          width="230"
          height="130"
          rx="12"
          fill="var(--surface-card)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M15 17H215M15 112H215M15 65H215"
          stroke="currentColor"
          opacity=".4"
        />
        {Array.from({ length: 14 }, (_, x) =>
          Array.from({ length: 6 }, (_, y) => (
            <circle
              key={`${x}-${y}`}
              cx={20 + x * 14.5}
              cy={30 + y * 14}
              r="2"
              fill="var(--ink-muted)"
            />
          )),
        )}
      </g>
      <g transform="translate(321 219)">
        <path
          d="M-18 10H0M-18 28H0M-18 46H0M90 10H108M90 28H108M90 46H108"
          stroke="currentColor"
          strokeWidth="6"
        />
        <rect width="90" height="58" rx="7" fill="var(--ink)" />
        <circle cx="15" cy="14" r="4" fill="var(--surface-card)" />
        <path d="M32 29H65" stroke="var(--surface-card)" strokeWidth="3" />
      </g>
      <path
        d="M240 235H260V190H450V218"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="450"
        cy="237"
        r="18"
        fill="var(--accent-soft)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M443 260V286M457 260V278"
        stroke="currentColor"
        strokeWidth="3"
      />
    </svg>
  );
}
